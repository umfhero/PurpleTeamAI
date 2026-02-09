// Security Score Calculator - calculates 0-100 security score based on vulnerabilities

import type { NmapScanData } from '../scanner/types'
import { getOWASPCoverage } from './owasp-mapper'

export interface SecurityScore {
  overall: number // 0-100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  breakdown: {
    severityImpact: number // Points lost due to vulnerabilities
    owaspCoverage: number // Penalty for wide OWASP coverage (more categories = worse)
    remediationPotential: number // Bonus for having actionable fixes
  }
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

/**
 * Calculates security score using weighted vulnerability severity and OWASP coverage.
 * 
 * Algorithm:
 * - Start at 100 points
 * - Critical vulns: -20 each
 * - High vulns: -10 each
 * - Medium vulns: -5 each
 * - Low vulns: -2 each
 * - Info vulns: -1 each
 * - OWASP coverage penalty: -5 per category found (wide attack surface = worse)
 * - Remediation bonus: up to +10 if all vulns have LLM analysis (indicates fixability)
 * - Floor at 0, ceiling at 100
 */
export function calculateSecurityScore(
  scanData: NmapScanData,
  hasLLMAnalysis: boolean = false
): SecurityScore {
  const vulns = scanData.vulnerabilities

  // Count vulnerabilities by severity
  const counts = {
    critical: vulns.filter(v => v.severity === 'critical').length,
    high: vulns.filter(v => v.severity === 'high').length,
    medium: vulns.filter(v => v.severity === 'medium').length,
    low: vulns.filter(v => v.severity === 'low').length,
    info: vulns.filter(v => v.severity === 'info').length
  }

  // Calculate severity impact (points lost)
  const severityImpact = 
    (counts.critical * 20) +
    (counts.high * 10) +
    (counts.medium * 5) +
    (counts.low * 2) +
    (counts.info * 1)

  // Calculate OWASP coverage penalty
  const owaspCoverage = getOWASPCoverage(vulns)
  const owaspPenalty = owaspCoverage.total * 5 // 5 points per category

  // Remediation potential bonus
  let remediationBonus = 0
  if (hasLLMAnalysis && vulns.length > 0) {
    remediationBonus = 10 // Full bonus if LLM analysis available
  }

  // Calculate final score
  const baseScore = 100
  const finalScore = Math.max(0, Math.min(100, 
    baseScore - severityImpact - owaspPenalty + remediationBonus
  ))

  // Determine letter grade
  let grade: SecurityScore['grade']
  if (finalScore >= 95) grade = 'A+'
  else if (finalScore >= 85) grade = 'A'
  else if (finalScore >= 70) grade = 'B'
  else if (finalScore >= 50) grade = 'C'
  else if (finalScore >= 30) grade = 'D'
  else grade = 'F'

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
    recommendations.push('No vulnerabilities detected - maintain current security posture')
  } else if (finalScore >= 85) {
    recommendations.push('Strong security posture - address remaining issues to reach A+')
  }

  return {
    overall: Math.round(finalScore),
    grade,
    breakdown: {
      severityImpact: -severityImpact,
      owaspCoverage: -owaspPenalty,
      remediationPotential: remediationBonus
    },
    details: {
      totalVulnerabilities: vulns.length,
      ...counts
    },
    recommendations
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
