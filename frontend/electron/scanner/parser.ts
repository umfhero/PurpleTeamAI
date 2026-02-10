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

  // ═══════════════════════════════════════════════════════════
  // POST-PROCESSING: Detect issues that Nmap scripts alone won't flag
  // ═══════════════════════════════════════════════════════════

  // 1. Security header analysis — check http-headers output for missing protections
  //    (clickjacking, CSP, MIME sniffing, HSTS)
  if (rawPorts) {
    const portList = Array.isArray(rawPorts) ? rawPorts : [rawPorts]
    for (const port of portList) {
      const portScripts = port.script
      if (portScripts) {
        const scripts = Array.isArray(portScripts) ? portScripts : [portScripts]
        for (const script of scripts) {
          if (script.id === 'http-headers' && script.output) {
            const headerVulns = checkMissingSecurityHeaders(
              script.output,
              parseInt(port.portid, 10),
              port.service?.name,
              vulnCounter
            )
            vulnerabilities.push(...headerVulns)
            vulnCounter += headerVulns.length
          }
        }
      }
    }
  }

  // 2. HTTP-only detection — if port 80 open but no 443/HTTPS, flag cleartext comms
  const httpPorts = ports.filter(p =>
    p.state === 'open' && (p.service === 'http' || p.port === 80 || p.port === 8080)
  )
  const httpsPorts = ports.filter(p =>
    p.state === 'open' && (p.service === 'https' || p.service === 'ssl/http' || p.port === 443 || p.port === 8443)
  )
  if (httpPorts.length > 0 && httpsPorts.length === 0) {
    vulnerabilities.push({
      id: `http-only-${vulnCounter++}`,
      title: 'Unencrypted HTTP Only (No HTTPS)',
      description: 'The server only serves content over unencrypted HTTP. No HTTPS (port 443) was detected. All data including credentials and session cookies are transmitted in cleartext, vulnerable to interception via man-in-the-middle attacks.',
      severity: 'high',
      port: httpPorts[0].port,
      service: 'http',
      script: 'port-analysis',
      output: `HTTP port(s) open: ${httpPorts.map(p => p.port).join(', ')}. No HTTPS port detected.`,
    })
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
 * Check http-headers output for missing security headers and generate vulnerability entries.
 * Detects: clickjacking (X-Frame-Options), XSS mitigation (CSP), MIME sniffing, HSTS.
 */
function checkMissingSecurityHeaders(
  headersOutput: string,
  port: number,
  service: string | undefined,
  startIndex: number
): VulnerabilityResult[] {
  const vulns: VulnerabilityResult[] = []
  const outputLower = headersOutput.toLowerCase()

  const securityHeaders: Array<{
    name: string
    vuln: string
    severity: VulnerabilityResult['severity']
    description: string
  }> = [
    {
      name: 'X-Frame-Options',
      vuln: 'Clickjacking',
      severity: 'medium',
      description:
        'Missing X-Frame-Options header allows this page to be embedded in iframes on attacker-controlled sites, enabling clickjacking attacks where users are tricked into clicking hidden elements.',
    },
    {
      name: 'Content-Security-Policy',
      vuln: 'Missing CSP',
      severity: 'medium',
      description:
        'Missing Content-Security-Policy header. CSP is a critical defense-in-depth mechanism that helps prevent Cross-Site Scripting (XSS), clickjacking, and other code injection attacks by restricting which resources the browser can load.',
    },
    {
      name: 'X-Content-Type-Options',
      vuln: 'MIME Sniffing',
      severity: 'low',
      description:
        'Missing X-Content-Type-Options header. Without "nosniff", browsers may MIME-sniff the response content type, potentially interpreting non-executable content as executable, leading to XSS.',
    },
    {
      name: 'Strict-Transport-Security',
      vuln: 'Missing HSTS',
      severity: 'medium',
      description:
        'Missing Strict-Transport-Security (HSTS) header. Without HSTS, connections can be downgraded from HTTPS to HTTP via SSL-stripping attacks, exposing sensitive data in transit.',
    },
  ]

  for (const header of securityHeaders) {
    if (!outputLower.includes(header.name.toLowerCase())) {
      vulns.push({
        id: `missing-header-${header.name.toLowerCase().replace(/[^a-z]/g, '-')}-${startIndex++}`,
        title: `Missing ${header.name} (${header.vuln})`,
        description: header.description,
        severity: header.severity,
        port,
        service,
        script: 'security-headers',
        output: `Security header "${header.name}" not found in server response headers.\n\nRemediation: Add the ${header.name} header to your server configuration.`,
      })
    }
  }

  return vulns
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

  // Skip purely informational / recon scripts that report server metadata,
  // not actual security issues. Only filter scripts that are genuinely
  // non-security-relevant. Keep scripts like http-open-redirect, http-cookie-flags,
  // ftp-anon, http-git, dns-recursion, smb-security-mode etc. as they ARE findings.
  const nonVulnScripts = [
    'http-title', 'http-server-header', 'ssl-date',
    'http-favicon', 'http-headers', 'http-sitemap-generator',
    'http-ntlm-info',
    'ssl-cert',
    'dns-nsid', 'dns-service-discovery',
    'banner', 'fingerprint-strings',
    'nbstat', 'smb-os-discovery',
    'ssh-hostkey',
    'ftp-syst',
  ]
  if (nonVulnScripts.includes(id)) {
    return null
  }

  // Filter out "negative" results — scripts that ran but found nothing
  const outputLower = output.toLowerCase()
  const negativeIndicators = [
    "couldn't find",
    "could not find",
    "not found",
    "no vulnerabilities",
    "not vulnerable",
    "not affected",
    "doesn't seem to be vulnerable",
    "does not appear to be vulnerable",
    "no issues found",
    "no matches found",
    "no results",
  ]
  
  const hasNegativeResult = negativeIndicators.some(phrase => outputLower.includes(phrase))
  if (hasNegativeResult && outputLower.length < 200) {
    // Short output with negative phrase = no findings, skip it
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
  // Note: 'vuln' in script ID alone is too broad (e.g. 'vulners' is a reference DB, not a confirmed vuln)
  // Require 'vulnerable' in the OUTPUT (confirms a finding) or specific vuln script patterns
  if (
    lowerId.includes('sqli') ||
    lowerId.includes('sql-injection') ||
    lowerId.includes('xss') ||
    (lowerId.includes('vuln') && !lowerId.includes('vulners') && lowerOutput.includes('vulnerable')) ||
    lowerOutput.includes('state: vulnerable') ||
    lowerOutput.includes('sql injection') ||
    lowerOutput.includes('cross-site scripting')
  ) {
    return 'high'
  }

  // Vulners script: parse CVSS scores from output for accurate severity.
  // Output format is "ID SCORE URL" per line, e.g.:
  //   CVE-2021-23017  7.7  https://vulners.com/cve/CVE-2021-23017
  //   3F71F065-66D4-541F-A813-... 8.8 https://vulners.com/githubexploit/...
  // Extract all decimal numbers that look like CVSS scores (0.0-10.0) and use the highest.
  if (lowerId === 'vulners') {
    const scoreMatches = output.match(/\b(\d{1,2}\.\d)\b/g)
    if (scoreMatches) {
      const scores = scoreMatches.map(Number).filter(s => s >= 0 && s <= 10)
      if (scores.length > 0) {
        const maxCvss = Math.max(...scores)
        if (maxCvss >= 9.0) return 'critical'
        if (maxCvss >= 7.0) return 'high'
        if (maxCvss >= 4.0) return 'medium'
        return 'low'
      }
    }
    // vulners output without any CVSS score is informational
    return 'info'
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
