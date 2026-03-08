// Security Score Calculator - calculates 0-100 security score based on vulnerabilities

import type { NmapScanData, VulnerabilityResult } from '../scanner/types'
import { getOWASPCoverage } from './owasp-mapper'
import { FEATURE_TOGGLES } from './feature-toggles'

// ============================================
// Contextual Multiplier Constants (Extension 4)
// ============================================

/** Port exposure multipliers — commonly targeted ports carry more real-world risk */
const PORT_EXPOSURE: Record<string, number> = {
  // High-exposure web ports
  '80': 1.5, '443': 1.5, '8080': 1.5, '8443': 1.5,
  // High-exposure service ports
  '21': 1.3,   // FTP
  '22': 1.3,   // SSH
  '23': 1.3,   // Telnet
  '25': 1.3,   // SMTP
  '3389': 1.3, // RDP
}
const PORT_EXPOSURE_DEFAULT = 1.0

/** Service exposure multipliers — database/admin services grant direct data access */
const SERVICE_EXPOSURE_HIGH = 1.5
const SERVICE_EXPOSURE_MEDIUM = 1.3
const SERVICE_EXPOSURE_DEFAULT = 1.0

const SERVICE_PATTERNS_HIGH = /\b(mysql|postgres|mssql|oracle|mongodb|redis|memcached|elasticsearch)\b/i
const SERVICE_PATTERNS_MEDIUM = /\b(ftp|telnet|vnc|rdp|smb)\b/i

/** Authentication weakness multipliers */
const AUTH_WEAKNESS_HIGH = 1.8
const AUTH_WEAKNESS_MEDIUM = 1.4
const AUTH_WEAKNESS_DEFAULT = 1.0

const AUTH_PATTERNS_HIGH = /default.?cred|default.?password|anonymous.?login|no.?auth|weak.?password|brute.?force|login.?bypass/i
const AUTH_PATTERNS_MEDIUM = /basic.?auth|cleartext.?password|plain.?text.?auth|unencrypted.?login/i

/** TLS absence penalty — flat deduction when HTTP exists without HTTPS */
const TLS_ABSENCE_PENALTY = 8

// ============================================
// Types
// ============================================

export interface ContextualFactors {
  portExposure: number
  serviceExposure: number
  authWeakness: number
  combined: number
}

export interface ContextualWeightingSummary {
  tlsPenaltyApplied: boolean
  totalBaseDeductions: number
  totalAdjustedDeductions: number
}

export interface VulnerabilityContextualDetail {
  vulnerabilityId: string
  baseDeduction: number
  adjustedDeduction: number
  contextualFactors: ContextualFactors
}

export interface SecurityScore {
  overall: number // 0-100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  confidence: 'high' | 'medium' | 'low'
  confidenceReason: string
  breakdown: {
    severityImpact: number // Points lost due to vulnerabilities
    owaspCoverage: number // Penalty for wide OWASP coverage (more categories = worse)
    remediationPotential: number // Bonus for having actionable fixes
  }
  contextualWeightingEnabled: boolean
  contextualWeighting?: ContextualWeightingSummary
  vulnerabilityContextDetails?: VulnerabilityContextualDetail[]
  details: {
    totalVulnerabilities: number
    critical: number
    high: number
    medium: number
    low: number
    info: number
  }
  recommendations: string[]
}

// ============================================
// Multiplier Helpers (Extension 4)
// ============================================

/** Returns the port exposure multiplier for a vulnerability */
function getPortMultiplier(vuln: VulnerabilityResult): number {
  if (vuln.port == null) return PORT_EXPOSURE_DEFAULT
  return PORT_EXPOSURE[String(vuln.port)] ?? PORT_EXPOSURE_DEFAULT
}

/** Returns the service exposure multiplier for a vulnerability */
function getServiceMultiplier(vuln: VulnerabilityResult): number {
  const service = vuln.service || ''
  if (SERVICE_PATTERNS_HIGH.test(service)) return SERVICE_EXPOSURE_HIGH
  if (SERVICE_PATTERNS_MEDIUM.test(service)) return SERVICE_EXPOSURE_MEDIUM
  return SERVICE_EXPOSURE_DEFAULT
}

/** Returns the authentication weakness multiplier for a vulnerability */
function getAuthMultiplier(vuln: VulnerabilityResult): number {
  const searchText = [vuln.title, vuln.description, vuln.output || ''].join(' ')
  if (AUTH_PATTERNS_HIGH.test(searchText)) return AUTH_WEAKNESS_HIGH
  if (AUTH_PATTERNS_MEDIUM.test(searchText)) return AUTH_WEAKNESS_MEDIUM
  return AUTH_WEAKNESS_DEFAULT
}

/** Returns the base severity deduction for a vulnerability */
function getBaseDeduction(severity: VulnerabilityResult['severity']): number {
  switch (severity) {
    case 'critical': return 20
    case 'high': return 10
    case 'medium': return 5
    case 'low': return 2
    case 'info': return 1
  }
}

/** Checks whether TLS absence penalty should apply */
function shouldApplyTLSPenalty(scanData: NmapScanData): boolean {
  const openPorts = scanData.ports.filter(p => p.state === 'open')
  const hasHTTP = openPorts.some(p =>
    (p.service && /^http$/i.test(p.service)) ||
    [80, 8080].includes(p.port)
  )
  if (!hasHTTP) return false

  const hasHTTPS = openPorts.some(p =>
    (p.service && /https|ssl\/http/i.test(p.service)) ||
    p.port === 443
  )
  return !hasHTTPS
}

// ============================================
// Main Scorer
// ============================================

/**
 * Calculates security score using weighted vulnerability severity and OWASP coverage.
 * 
 * Algorithm:
 * - Start at 100 points
 * - Per-vulnerability deductions: critical −20, high −10, medium −5, low −2, info −1
 * - When contextualWeighting is ON (Extension 4), each deduction is multiplied by
 *   portExposure × serviceExposure × authWeakness before summing.
 * - TLS absence penalty: −8 if HTTP present without HTTPS (applied once)
 * - OWASP coverage penalty: −5 per category found (wide attack surface = worse)
 * - Remediation bonus: +10 if LLM analysis exists (indicates fixability)
 * - Floor at 0, ceiling at 100
 * 
 * Confidence is calculated separately based on scan coverage — a high score
 * with low confidence means the scanner couldn't find much, NOT that the target is secure.
 */
export function calculateSecurityScore(
  scanData: NmapScanData,
  hasLLMAnalysis: boolean
): SecurityScore {
  const vulns = scanData.vulnerabilities
  const useWeighting = FEATURE_TOGGLES.contextualWeighting

  // Count vulnerabilities by severity
  const counts = {
    critical: vulns.filter(v => v.severity === 'critical').length,
    high: vulns.filter(v => v.severity === 'high').length,
    medium: vulns.filter(v => v.severity === 'medium').length,
    low: vulns.filter(v => v.severity === 'low').length,
    info: vulns.filter(v => v.severity === 'info').length
  }

  // Calculate per-vulnerability deductions with optional contextual multipliers
  let totalBaseDeductions = 0
  let totalAdjustedDeductions = 0
  const vulnContextDetails: VulnerabilityContextualDetail[] = []

  for (const vuln of vulns) {
    const base = getBaseDeduction(vuln.severity)
    totalBaseDeductions += base

    if (useWeighting) {
      const portMul = getPortMultiplier(vuln)
      const serviceMul = getServiceMultiplier(vuln)
      const authMul = getAuthMultiplier(vuln)
      const combined = portMul * serviceMul * authMul
      const adjusted = base * combined
      totalAdjustedDeductions += adjusted

      vulnContextDetails.push({
        vulnerabilityId: vuln.id,
        baseDeduction: base,
        adjustedDeduction: Math.round(adjusted * 100) / 100,
        contextualFactors: {
          portExposure: portMul,
          serviceExposure: serviceMul,
          authWeakness: authMul,
          combined: Math.round(combined * 100) / 100,
        },
      })
    } else {
      totalAdjustedDeductions += base
    }
  }

  // TLS absence penalty (Extension 4) — only when weighting is active
  const tlsPenaltyApplied = useWeighting && shouldApplyTLSPenalty(scanData)
  if (tlsPenaltyApplied) {
    totalAdjustedDeductions += TLS_ABSENCE_PENALTY
  }

  // Calculate OWASP coverage penalty
  const owaspCoverage = getOWASPCoverage(vulns)
  const owaspPenalty = owaspCoverage.total * 5 // 5 points per category

  // Remediation potential bonus
  let remediationBonus = 0
  if (hasLLMAnalysis && vulns.length > 0) {
    remediationBonus = 10 // Full bonus if LLM analysis available
  }

  // Calculate final score using adjusted deductions
  const baseScore = 100
  const finalScore = Math.max(0, Math.min(100,
    baseScore - totalAdjustedDeductions - owaspPenalty + remediationBonus
  ))

  // Determine letter grade
  let grade: SecurityScore['grade']
  if (finalScore >= 95) grade = 'A+'
  else if (finalScore >= 85) grade = 'A'
  else if (finalScore >= 70) grade = 'B'
  else if (finalScore >= 50) grade = 'C'
  else if (finalScore >= 30) grade = 'D'
  else grade = 'F'

  // Calculate scan confidence — how much can we trust this score?
  const { confidence, confidenceReason } = calculateConfidence(scanData, vulns.length)

  // Generate recommendations
  const recommendations: string[] = []

  if (counts.critical > 0) {
    recommendations.push(`Address ${counts.critical} critical vulnerabilit${counts.critical === 1 ? 'y' : 'ies'} immediately`)
  }

  if (counts.high > 0) {
    recommendations.push(`Fix ${counts.high} high-severity issue${counts.high === 1 ? '' : 's'} as priority`)
  }

  if (owaspCoverage.total >= 5) {
    recommendations.push(`Wide attack surface detected (${owaspCoverage.total}/10 OWASP categories) - implement defense in depth`)
  }

  if (!hasLLMAnalysis && vulns.length > 0) {
    recommendations.push('Run AI analysis for detailed remediation guidance')
  }

  if (counts.medium > 5) {
    recommendations.push('Systematic code review needed - multiple medium-severity issues found')
  }

  if (vulns.length === 0) {
    recommendations.push('No vulnerabilities detected by automated scanner — this does not guarantee security')
    recommendations.push('Nmap has limited web app testing coverage — supplement with dedicated web scanners (ZAP, Burp Suite, Nikto)')
  } else if (confidence === 'low') {
    recommendations.push('Low scan confidence — results may not reflect the full attack surface')
    recommendations.push('Consider running additional web application scanners for deeper coverage')
  } else if (finalScore >= 85) {
    recommendations.push('Strong security posture detected — address remaining issues to reach A+')
  }

  if (tlsPenaltyApplied) {
    recommendations.push('No HTTPS detected — enable TLS to protect data in transit')
  }

  const result: SecurityScore = {
    overall: Math.round(finalScore),
    grade,
    confidence,
    confidenceReason,
    contextualWeightingEnabled: useWeighting,
    breakdown: {
      severityImpact: -Math.round(totalAdjustedDeductions),
      owaspCoverage: -owaspPenalty,
      remediationPotential: remediationBonus
    },
    details: {
      totalVulnerabilities: vulns.length,
      ...counts
    },
    recommendations
  }

  if (useWeighting) {
    result.contextualWeighting = {
      tlsPenaltyApplied,
      totalBaseDeductions: Math.round(totalBaseDeductions),
      totalAdjustedDeductions: Math.round(totalAdjustedDeductions * 100) / 100,
    }
    result.vulnerabilityContextDetails = vulnContextDetails
  }

  return result
}

/**
 * Calculate scan confidence — how much should we trust this score?
 * 
 * A high score with low confidence means "we couldn't find much" not "the target is secure".
 * This prevents the misleading 100/100 A+ when the scanner simply didn't detect anything.
 */
function calculateConfidence(
  scanData: NmapScanData,
  vulnCount: number
): { confidence: 'high' | 'medium' | 'low'; confidenceReason: string } {
  const openPorts = scanData.ports.filter(p => p.state === 'open')
  const httpPorts = openPorts.filter(p =>
    ['http', 'https', 'http-proxy', 'ssl/http'].includes(p.service || '') ||
    [80, 443, 8080, 8443].includes(p.port)
  )

  // No open ports at all — target may be unreachable or heavily firewalled
  if (openPorts.length === 0) {
    return {
      confidence: 'low',
      confidenceReason: 'No open ports detected — target may be unreachable or heavily filtered'
    }
  }

  // Web services found but zero vulnerabilities — very suspicious, scanner likely missed things
  if (httpPorts.length > 0 && vulnCount === 0) {
    return {
      confidence: 'low',
      confidenceReason: 'Web services detected but no vulnerabilities found — Nmap has limited web application testing coverage'
    }
  }

  // Web services found but very few vulnerabilities
  if (httpPorts.length > 0 && vulnCount <= 2) {
    return {
      confidence: 'medium',
      confidenceReason: 'Few vulnerabilities detected — Nmap scripts provide partial coverage of web application vulnerabilities'
    }
  }

  // Non-web target with no vulns — more reasonable since fewer attack vectors
  if (httpPorts.length === 0 && vulnCount === 0 && openPorts.length > 0) {
    return {
      confidence: 'medium',
      confidenceReason: 'No web services detected — limited attack surface for vulnerability scanning'
    }
  }

  // Decent number of findings — scan likely captured meaningful data
  if (vulnCount >= 5) {
    return {
      confidence: 'high',
      confidenceReason: 'Sufficient vulnerability data collected for reliable scoring'
    }
  }

  return {
    confidence: 'medium',
    confidenceReason: 'Moderate vulnerability data collected — score reflects detected issues only'
  }
}

/**
 * Gets a severity color for the score grade.
 */
export function getScoreColor(grade: SecurityScore['grade']): string {
  switch (grade) {
    case 'A+':
    case 'A':
      return '#10b981' // green
    case 'B':
      return '#3b82f6' // blue
    case 'C':
      return '#f59e0b' // orange
    case 'D':
      return '#ef4444' // red
    case 'F':
      return '#991b1b' // dark red
  }
}

/**
 * Formats the score for display.
 */
export function formatScore(score: number): string {
  return `${score}/100`
}
