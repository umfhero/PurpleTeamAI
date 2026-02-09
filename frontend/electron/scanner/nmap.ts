import { spawn, type ChildProcess } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseNmapXml } from './parser'
import type { NmapScanData } from './types'
import { calculateSecurityScore } from '../analysis/security-scorer'
import { getOWASPCoverage, getOWASPDistribution } from '../analysis/owasp-mapper'

// Directory for storing scan results
const SCANS_DIR = path.join(process.cwd(), 'data', 'scans')

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
  scanType?: 'quick' | 'full' | 'vuln'
  timeout?: number // in seconds
}

export interface ScanResult {
  success: boolean
  message?: string
  data?: NmapScanData
}

/**
 * Run an Nmap scan against a target
 * @param onProgress - Optional callback for real-time output
 */
export async function runNmapScan(
  options: NmapOptions, 
  onProgress?: (line: string) => void
): Promise<ScanResult> {
  const { target, scanType = 'vuln', timeout = 900 } = options // 15 minutes default for vuln scans

  await ensureScansDir()

  // Build Nmap arguments based on scan type
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputFile = path.join(SCANS_DIR, `scan-${timestamp}.xml`)

  let args: string[]
  switch (scanType) {
    case 'quick':
      // Quick scan with common HTTP vulnerability scripts
      args = [
        '-sV', '-F', '-T4',
        '--script', 'http-vuln-*,ssl-*,vulners',
        '-oX', outputFile, target
      ]
      break
    case 'full':
      args = ['-sV', '-sC', '-p-', '-oX', outputFile, target]
      break
    case 'vuln':
    default:
      // Full vulnerability scan with all vuln scripts
      args = ['-sV', '-sC', '--script', 'vuln,vulners,http-enum,http-headers', '-oX', outputFile, target]
      break
  }

  const commandStr = `nmap ${args.join(' ')}`
  console.log(`[Scanner] Starting Nmap scan: ${commandStr}`)
  onProgress?.(`[Scanner] Starting scan: ${commandStr}\n`)

  return new Promise((resolve) => {
    const startTime = Date.now()
    let stderr = ''
    scanAborted = false

    const nmap = spawn('nmap', args, {
      timeout: timeout * 1000,
    })
    
    // Store reference for abort capability
    currentScanProcess = nmap

    // Capture stdout for live progress
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
      resolve({
        success: false,
        message: `Failed to start Nmap: ${err.message}. Is Nmap installed and in PATH?`,
      })
    })

    nmap.on('close', async (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      currentScanProcess = null // Clear reference
      
      // Handle user abort
      if (scanAborted) {
        console.log(`[Scanner] Scan aborted by user after ${elapsed}s`)
        onProgress?.(`\n[Scanner] Scan aborted by user after ${elapsed}s\n`)
        resolve({
          success: false,
          message: 'Scan aborted by user',
        })
        return
      }
      
      console.log(`[Scanner] Nmap exited with code ${code} after ${elapsed}s`)
      onProgress?.(`\n[Scanner] Scan completed in ${elapsed}s (exit code: ${code})\n`)

      // Handle timeout (code is null when process is killed)
      if (code === null) {
        resolve({
          success: false,
          message: `Nmap scan timed out after ${elapsed}s. Try a 'quick' scan for faster results, or increase timeout.`,
        })
        return
      }

      if (code !== 0) {
        resolve({
          success: false,
          message: `Nmap exited with code ${code}: ${stderr}`,
        })
        return
      }

      // Parse the XML output
      try {
        onProgress?.(`\n[Scanner] Parsing scan results...\n`)
        const xmlContent = await fs.readFile(outputFile, 'utf-8')
        const scanData = await parseNmapXml(xmlContent, target)

        onProgress?.(`[Scanner] Found ${scanData.ports.length} open ports\n`)
        onProgress?.(`[Scanner] Found ${scanData.vulnerabilities.length} vulnerabilities\n`)

        // Calculate security score and OWASP coverage
        onProgress?.(`[Scanner] Calculating security score...\n`)
        const hasLLMAnalysis = !!scanData.llmAnalysis
        scanData.securityScore = calculateSecurityScore(scanData, hasLLMAnalysis)
        scanData.owaspCoverage = getOWASPCoverage(scanData.vulnerabilities)
        scanData.owaspDistribution = getOWASPDistribution(scanData.vulnerabilities)

        // Save JSON result alongside XML
        const jsonFile = outputFile.replace('.xml', '.json')
        await fs.writeFile(jsonFile, JSON.stringify(scanData, null, 2))

        console.log(`[Scanner] Scan complete. Found ${scanData.ports.length} ports, ${scanData.vulnerabilities.length} vulnerabilities`)
        console.log(`[Scanner] Security score: ${scanData.securityScore.overall}/100 (${scanData.securityScore.grade})`)
        console.log(`[Scanner] OWASP coverage: ${scanData.owaspCoverage.total}/10 categories`)

        onProgress?.(`[Scanner] Security score: ${scanData.securityScore.overall}/100 (${scanData.securityScore.grade})\n`)
        onProgress?.(`[Scanner] OWASP coverage: ${scanData.owaspCoverage.total}/10 categories\n`)
        onProgress?.(`\n✓ Scan complete!\n`)

        resolve({
          success: true,
          data: scanData,
        })
      } catch (err) {
        console.error('[Scanner] Failed to parse Nmap output:', err)
        onProgress?.(`[Error] Failed to parse scan results: ${err instanceof Error ? err.message : 'Unknown error'}\n`)
        resolve({
          success: false,
          message: `Failed to parse scan results: ${err instanceof Error ? err.message : 'Unknown error'}`,
        })
      }
    })
  })
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
