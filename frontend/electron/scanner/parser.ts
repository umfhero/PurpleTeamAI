import { parseStringPromise } from 'xml2js'
import type { NmapScanData, PortResult, VulnerabilityResult } from './types'

/**
 * Parse Nmap XML output into structured JSON
 */
export async function parseNmapXml(xmlContent: string, target: string): Promise<NmapScanData> {
  const result = await parseStringPromise(xmlContent, {
    explicitArray: false,
    mergeAttrs: true,
  })

  const nmaprun = result.nmaprun
  const host = nmaprun.host

  // Parse ports
  const ports: PortResult[] = []
  const rawPorts = host?.ports?.port

  if (rawPorts) {
    const portList = Array.isArray(rawPorts) ? rawPorts : [rawPorts]
    for (const port of portList) {
      ports.push({
        port: parseInt(port.portid, 10),
        protocol: port.protocol || 'tcp',
        state: port.state?.state || 'unknown',
        service: port.service?.name || 'unknown',
        version: port.service?.version,
        product: port.service?.product,
      })
    }
  }

  // Parse vulnerabilities from script outputs
  const vulnerabilities: VulnerabilityResult[] = []
  let vulnCounter = 0

  // Check host scripts
  const hostScripts = host?.hostscript?.script
  if (hostScripts) {
    const scripts = Array.isArray(hostScripts) ? hostScripts : [hostScripts]
    for (const script of scripts) {
      const vuln = parseScriptToVulnerability(script, vulnCounter++)
      if (vuln) vulnerabilities.push(vuln)
    }
  }

  // Check port scripts
  if (rawPorts) {
    const portList = Array.isArray(rawPorts) ? rawPorts : [rawPorts]
    for (const port of portList) {
      const portScripts = port.script
      if (portScripts) {
        const scripts = Array.isArray(portScripts) ? portScripts : [portScripts]
        for (const script of scripts) {
          const vuln = parseScriptToVulnerability(script, vulnCounter++, parseInt(port.portid, 10), port.service?.name)
          if (vuln) vulnerabilities.push(vuln)
        }
      }
    }
  }

  return {
    target,
    timestamp: new Date().toISOString(),
    scanType: nmaprun.args || 'unknown',
    ports,
    vulnerabilities,
    rawXml: xmlContent,
  }
}

/**
 * Parse an Nmap script output into a vulnerability result
 */
function parseScriptToVulnerability(
  script: { id: string; output: string; elem?: unknown },
  index: number,
  port?: number,
  service?: string
): VulnerabilityResult | null {
  const id = script.id || `vuln-${index}`
  const output = script.output || ''

  // Skip informational scripts that aren't vulnerabilities
  const nonVulnScripts = ['http-title', 'http-server-header', 'ssl-date', 'http-methods']
  if (nonVulnScripts.includes(id)) {
    return null
  }

  // Try to extract CVE from output
  const cveMatch = output.match(/CVE-\d{4}-\d+/i)
  const cve = cveMatch ? cveMatch[0].toUpperCase() : undefined

  // Determine severity based on script name and output
  const severity = determineSeverity(id, output)

  // Extract title - use script ID as base, clean it up
  const title = id
    .replace(/-/g, ' ')
    .replace(/^(http|ssl|smb|ftp|ssh)\s+/i, '')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return {
    id: `${id}-${index}`,
    cve,
    title,
    description: output.trim().slice(0, 500), // Truncate long outputs
    severity,
    port,
    service,
    script: id,
    output: output.trim(),
  }
}

/**
 * Determine vulnerability severity based on script and output
 */
function determineSeverity(scriptId: string, output: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  const lowerOutput = output.toLowerCase()
  const lowerId = scriptId.toLowerCase()

  // Critical indicators
  if (
    lowerId.includes('rce') ||
    lowerId.includes('remote-exec') ||
    lowerOutput.includes('remote code execution') ||
    lowerOutput.includes('unauthenticated')
  ) {
    return 'critical'
  }

  // High severity indicators
  if (
    lowerId.includes('sqli') ||
    lowerId.includes('sql-injection') ||
    lowerId.includes('xss') ||
    lowerId.includes('vuln') ||
    lowerOutput.includes('vulnerable') ||
    lowerOutput.includes('sql injection') ||
    lowerOutput.includes('cross-site scripting')
  ) {
    return 'high'
  }

  // Medium severity indicators
  if (
    lowerId.includes('csrf') ||
    lowerId.includes('clickjacking') ||
    lowerId.includes('ssl') ||
    lowerId.includes('tls') ||
    lowerOutput.includes('deprecated') ||
    lowerOutput.includes('weak')
  ) {
    return 'medium'
  }

  // Low severity indicators
  if (
    lowerId.includes('info') ||
    lowerId.includes('enum') ||
    lowerId.includes('methods') ||
    lowerOutput.includes('allowed methods') ||
    lowerOutput.includes('directory listing')
  ) {
    return 'low'
  }

  return 'info'
}
