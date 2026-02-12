import { spawn, type ChildProcess } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseNmapXml } from './parser'
import type { NmapScanData, PortResult, VulnerabilityResult } from './types'
import { calculateSecurityScore } from '../analysis/security-scorer'
import { getOWASPCoverage, getOWASPDistribution } from '../analysis/owasp-mapper'

// Directory for storing scan results
const SCANS_DIR = path.join(process.cwd(), 'data', 'scans')

// Cache for Nmap executable path
let nmapPath: string | null = null

/**
 * Find the Nmap executable path
 * Checks common installation locations on Windows, macOS, and Linux
 */
async function findNmapPath(): Promise<string> {
  // Return cached path if already found
  if (nmapPath) return nmapPath

  const possiblePaths = process.platform === 'win32'
    ? [
      'nmap', // Check PATH first
      'C:\\Program Files (x86)\\Nmap\\nmap.exe',
      'C:\\Program Files\\Nmap\\nmap.exe',
    ]
    : ['nmap', '/usr/bin/nmap', '/usr/local/bin/nmap', '/opt/homebrew/bin/nmap']

  for (const testPath of possiblePaths) {
    try {
      // Test if nmap is accessible by running --version
      const testProcess = spawn(testPath, ['--version'])
      const isValid = await new Promise<boolean>((resolve) => {
        testProcess.on('error', () => resolve(false))
        testProcess.on('close', (code) => resolve(code === 0))
      })

      if (isValid) {
        nmapPath = testPath
        console.log(`[Scanner] Found Nmap at: ${testPath}`)
        return testPath
      }
    } catch {
      // Continue to next path
    }
  }

  throw new Error('Nmap not found. Please install Nmap from https://nmap.org/download.html')
}

// Track the current running scan process for abort capability
let currentScanProcess: ChildProcess | null = null
let scanAborted = false

/**
 * Abort the currently running scan
 */
export function abortScan(): { success: boolean; message: string } {
  if (!currentScanProcess) {
    return { success: false, message: 'No scan is currently running' }
  }

  scanAborted = true
  currentScanProcess.kill('SIGTERM')
  currentScanProcess = null
  console.log('[Scanner] Scan aborted by user')
  return { success: true, message: 'Scan aborted' }
}

// Ensure scans directory exists
async function ensureScansDir(): Promise<void> {
  try {
    await fs.mkdir(SCANS_DIR, { recursive: true })
  } catch (err) {
    console.error('Failed to create scans directory:', err)
  }
}

export interface NmapOptions {
  target: string
  timeout?: number // in seconds per phase
}

export interface ScanResult {
  success: boolean
  message?: string
  data?: NmapScanData
}

/**
 * Merge scan results from two phases, deduplicating ports and vulnerabilities.
 */
function mergeScanResults(phase1: NmapScanData, phase2: NmapScanData): NmapScanData {
  // Merge ports by port+protocol key (prefer entry with more version info)
  const portMap = new Map<string, PortResult>()
  for (const port of phase1.ports) {
    portMap.set(`${port.port}/${port.protocol}`, port)
  }
  for (const port of phase2.ports) {
    const key = `${port.port}/${port.protocol}`
    const existing = portMap.get(key)
    if (!existing || port.version || port.product) {
      portMap.set(key, port)
    }
  }

  // Merge vulnerabilities by script+port key to deduplicate
  const vulnMap = new Map<string, VulnerabilityResult>()
  for (const vuln of phase1.vulnerabilities) {
    vulnMap.set(`${vuln.script || vuln.id}-${vuln.port || 'host'}`, vuln)
  }
  for (const vuln of phase2.vulnerabilities) {
    vulnMap.set(`${vuln.script || vuln.id}-${vuln.port || 'host'}`, vuln)
  }

  return {
    ...phase1,
    ports: Array.from(portMap.values()).sort((a, b) => a.port - b.port),
    vulnerabilities: Array.from(vulnMap.values()),
  }
}

/**
 * Run a single nmap scan phase and parse results.
 */
async function runNmapPhase(
  nmapExecutable: string,
  args: string[],
  outputFile: string,
  target: string,
  timeout: number,
  onProgress?: (line: string) => void,
): Promise<ScanResult> {
  return new Promise((resolve) => {
    const startTime = Date.now()
    let stderr = ''

    const nmap = spawn(nmapExecutable, args, { timeout: timeout * 1000 })
    currentScanProcess = nmap

    nmap.stdout.on('data', (data) => {
      const output = data.toString()
      console.log(`[Nmap] ${output}`)
      onProgress?.(output)
    })

    nmap.stderr.on('data', (data) => {
      const output = data.toString()
      stderr += output
      console.error(`[Nmap Error] ${output}`)
      onProgress?.(`[Error] ${output}`)
    })

    nmap.on('error', (err) => {
      console.error('[Scanner] Nmap spawn error:', err)
      onProgress?.(`[Error] Failed to start Nmap: ${err.message}\n`)
      resolve({ success: false, message: `Failed to start Nmap: ${err.message}` })
    })

    nmap.on('close', async (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      currentScanProcess = null

      if (scanAborted) {
        console.log(`[Scanner] Scan aborted by user after ${elapsed}s`)
        onProgress?.(`\n[Scanner] Scan aborted after ${elapsed}s\n`)
        resolve({ success: false, message: 'Scan aborted by user' })
        return
      }

      console.log(`[Scanner] Nmap exited with code ${code} after ${elapsed}s`)
      onProgress?.(`\n[Scanner] Phase completed in ${elapsed}s (exit code: ${code})\n`)

      if (code === null) {
        resolve({ success: false, message: `Nmap timed out after ${elapsed}s` })
        return
      }

      if (code !== 0) {
        resolve({ success: false, message: `Nmap exited with code ${code}: ${stderr}` })
        return
      }

      try {
        onProgress?.(`[Scanner] Parsing scan results...\n`)
        const xmlContent = await fs.readFile(outputFile, 'utf-8')
        const scanData = await parseNmapXml(xmlContent, target)

        // Calculate scores
        scanData.securityScore = calculateSecurityScore(scanData, !!scanData.llmAnalysis)
        scanData.owaspCoverage = getOWASPCoverage(scanData.vulnerabilities)
        scanData.owaspDistribution = getOWASPDistribution(scanData.vulnerabilities)

        onProgress?.(`[Scanner] Found ${scanData.ports.length} ports, ${scanData.vulnerabilities.length} vulnerabilities\n`)
        onProgress?.(`[Scanner] Score: ${scanData.securityScore.overall}/100 (${scanData.securityScore.grade})\n`)
        resolve({ success: true, data: scanData })
      } catch (err) {
        resolve({
          success: false,
          message: `Failed to parse: ${err instanceof Error ? err.message : 'Unknown error'}`,
        })
      }
    })
  })
}

/**
 * Run a progressive Nmap scan in two phases:
 *   Phase 1 — Quick discovery: top 100 ports, service detection, vuln + vulners scripts
 *   Phase 2 — Deep scan: all 65535 ports, extended web app testing scripts (SQL injection, XSS, CSRF, etc.)
 *
 * Phase 1 results are emitted immediately via onPhaseComplete so the UI can show them
 * while Phase 2 continues. If Phase 2 fails or is aborted, Phase 1 results are returned.
 *
 * @param onProgress   - Line-by-line terminal output callback
 * @param onPhaseComplete - Called with Phase 1 results as soon as they're ready
 */
export async function runNmapScan(
  options: NmapOptions,
  onProgress?: (line: string) => void,
  onPhaseComplete?: (data: NmapScanData) => void,
): Promise<ScanResult> {
  const { target, timeout = 600 } = options // 10 min per phase default

  await ensureScansDir()
  scanAborted = false

  // Find nmap executable
  let nmapExecutable: string
  try {
    onProgress?.(`[Scanner] Locating Nmap executable...\n`)
    nmapExecutable = await findNmapPath()
    onProgress?.(`[Scanner] Using Nmap at: ${nmapExecutable}\n`)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Nmap not found'
    onProgress?.(`[Error] ${errorMsg}\n`)
    onProgress?.(`[Help] On Windows, download from https://nmap.org/download.html\n`)
    onProgress?.(`[Help] Make sure to select "Add Nmap to system PATH" during installation\n`)
    return { success: false, message: errorMsg }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  // ═══════════════════════════════════════════════════════════
  // PHASE 1 — Quick Discovery & Common Vulnerabilities
  // Top 100 ports · service detection · default + vuln scripts
  // Expected: ~2–4 minutes
  // ═══════════════════════════════════════════════════════════
  const phase1File = path.join(SCANS_DIR, `scan-${timestamp}.xml`)
  const phase1Args = [
    '-sV', '-sC', '-T3', '-F',
    '--script=vuln,vulners,ssl-enum-ciphers',
    '-oX', phase1File, target,
  ]

  onProgress?.(`\n${'═'.repeat(52)}\n`)
  onProgress?.(`  PHASE 1: Quick Discovery Scan\n`)
  onProgress?.(`  Top 100 ports · Service detection · Common vulns\n`)
  onProgress?.(`${'═'.repeat(52)}\n\n`)

  const phase1 = await runNmapPhase(nmapExecutable, phase1Args, phase1File, target, timeout, onProgress)

  if (!phase1.success || !phase1.data) {
    return phase1
  }

  // Emit Phase 1 results immediately so the UI can display them
  onProgress?.(`\n✓ Phase 1 complete: ${phase1.data.ports.length} ports, ${phase1.data.vulnerabilities.length} vulns [${phase1.data.securityScore?.grade}]\n`)
  onPhaseComplete?.(phase1.data)

  // Save Phase 1 JSON
  const jsonFile = phase1File.replace('.xml', '.json')
  await fs.writeFile(jsonFile, JSON.stringify(phase1.data, null, 2))

  if (scanAborted) {
    return phase1
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 2 — Deep Comprehensive Vulnerability Scan
  // All 65 535 ports · SQL injection · XSS · CSRF · enumeration
  // Expected: ~10–25 minutes
  // ═══════════════════════════════════════════════════════════
  const phase2File = path.join(SCANS_DIR, `scan-${timestamp}-deep.xml`)
  const deepScripts = [
    'vuln', 'vulners',
    'http-sql-injection', 'http-stored-xss', 'http-dombased-xss',
    'http-phpself-xss', 'http-csrf', 'http-enum',
    'http-shellshock', 'http-cookie-flags', 'http-method-tamper',
    'http-passwd', 'http-put', 'http-backup-finder',
    'http-config-backup', 'http-unsafe-output-escaping',
    'http-open-redirect', 'http-git',
    'ssl-enum-ciphers', 'ssl-poodle',
    'dns-recursion', 'ftp-anon',
  ].join(',')

  const phase2Args = [
    '-sV', '-T3', '-p-',
    `--script=${deepScripts}`,
    '-oX', phase2File, target,
  ]

  onProgress?.(`\n${'═'.repeat(52)}\n`)
  onProgress?.(`  PHASE 2: Deep Vulnerability Scan\n`)
  onProgress?.(`  All 65535 ports · SQLi · XSS · CSRF · Enumeration\n`)
  onProgress?.(`${'═'.repeat(52)}\n\n`)

  const phase2 = await runNmapPhase(nmapExecutable, phase2Args, phase2File, target, timeout * 3, onProgress)

  // If Phase 2 fails or was aborted, return Phase 1 results (still valid)
  if (!phase2.success || !phase2.data) {
    if (scanAborted) {
      onProgress?.(`\n[Scanner] Deep scan aborted — returning Phase 1 results\n`)
    } else {
      onProgress?.(`\n[Warning] Deep scan had issues — returning Phase 1 results\n`)
    }
    return phase1
  }

  // Merge Phase 1 + Phase 2
  onProgress?.(`\n[Scanner] Merging scan results...\n`)
  const merged = mergeScanResults(phase1.data, phase2.data)

  // Recalculate scores on merged data
  merged.securityScore = calculateSecurityScore(merged, !!merged.llmAnalysis)
  merged.owaspCoverage = getOWASPCoverage(merged.vulnerabilities)
  merged.owaspDistribution = getOWASPDistribution(merged.vulnerabilities)

  onProgress?.(`\n✓ Full scan complete: ${merged.ports.length} ports, ${merged.vulnerabilities.length} vulns [${merged.securityScore.grade}]\n`)
  onProgress?.(`\n✓ All phases complete!\n`)

  // Save merged JSON (overwrite Phase 1 file)
  await fs.writeFile(jsonFile, JSON.stringify(merged, null, 2))

  // Clean up Phase 2 XML
  try { await fs.unlink(phase2File) } catch { /* ignore */ }

  return { success: true, data: merged }
}

/**
 * Get list of previous scans
 */
export async function getScanHistory(): Promise<NmapScanData[]> {
  await ensureScansDir()

  try {
    const files = await fs.readdir(SCANS_DIR)
    const jsonFiles = files.filter((f) => f.endsWith('.json')).sort().reverse()

    const scans: NmapScanData[] = []
    for (const file of jsonFiles.slice(0, 20)) {
      // Last 20 scans
      try {
        const content = await fs.readFile(path.join(SCANS_DIR, file), 'utf-8')
        const scanData = JSON.parse(content) as NmapScanData

        // Calculate security score if missing (for old scans)
        if (!scanData.securityScore && scanData.vulnerabilities) {
          const hasLLMAnalysis = !!scanData.llmAnalysis
          scanData.securityScore = calculateSecurityScore(scanData, hasLLMAnalysis)
          scanData.owaspCoverage = getOWASPCoverage(scanData.vulnerabilities)
          scanData.owaspDistribution = getOWASPDistribution(scanData.vulnerabilities)

          // Save updated scan with scores
          await fs.writeFile(path.join(SCANS_DIR, file), JSON.stringify(scanData, null, 2))
        }

        scans.push(scanData)
      } catch {
        // Skip invalid files
      }
    }

    return scans
  } catch {
    return []
  }
}

/**
 * Validate target against allowlist
 */
export async function validateTarget(target: string): Promise<{ allowed: boolean; target: string }> {
  // Load allowlist
  const allowlistPath = path.join(process.cwd(), 'allowed-targets.json')

  try {
    const content = await fs.readFile(allowlistPath, 'utf-8')
    const allowlist = JSON.parse(content)

    const patterns: string[] = allowlist.targets.map((t: { pattern: string }) => t.pattern)
    const isAllowed = patterns.some((pattern) => target.toLowerCase().includes(pattern.toLowerCase()))

    return { allowed: isAllowed, target }
  } catch (err) {
    console.error('[Scanner] Failed to load allowlist:', err)
    // Fallback to hardcoded list if file not found
    const fallbackPatterns = ['testphp.vulnweb.com', 'localhost', '127.0.0.1', '::1']
    const isAllowed = fallbackPatterns.some((pattern) => target.toLowerCase().includes(pattern.toLowerCase()))
    return { allowed: isAllowed, target }
  }
}

/**
 * Delete a scan by timestamp
 */
export async function deleteScan(timestamp: string): Promise<{ success: boolean; message?: string }> {
  await ensureScansDir()

  try {
    // Find files with this timestamp
    const files = await fs.readdir(SCANS_DIR)
    const scanFiles = files.filter(f => f.includes(timestamp))

    if (scanFiles.length === 0) {
      return { success: false, message: 'Scan not found' }
    }

    // Delete all related files (JSON + XML)
    for (const file of scanFiles) {
      const filePath = path.join(SCANS_DIR, file)
      await fs.unlink(filePath)
      console.log(`[Scanner] Deleted scan file: ${file}`)
    }

    return { success: true, message: `Deleted ${scanFiles.length} scan file(s)` }
  } catch (err) {
    console.error('[Scanner] Failed to delete scan:', err)
    return {
      success: false,
      message: `Failed to delete scan: ${err instanceof Error ? err.message : 'Unknown error'}`
    }
  }
}

