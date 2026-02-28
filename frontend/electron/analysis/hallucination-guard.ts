// Hallucination Guard — Anti-hallucination layer for LLM analysis
// Cross-validates AI output against deterministic scan data to flag potential fabrications.

import type { VulnerabilityResult } from '../scanner/types'
import type { VulnerabilityAnalysis } from '../llm/types'
import { mapVulnerabilityToOWASP } from './owasp-mapper'
import { OWASPCategory } from './owasp-types'

// ============================================
// Types
// ============================================

export type HallucinationRisk = 'low' | 'medium' | 'high'

export interface CrossValidationResult {
  vulnerabilityId: string
  keywordCategories: OWASPCategory[]
  aiCategory: OWASPCategory | null
  agreement: boolean
  conflicts: string[]
}

export interface CVEVerificationResult {
  vulnerabilityId: string
  aiMentionedCVEs: string[]
  scanFoundCVEs: string[]
  inventedCVEs: string[]
  verified: boolean
}

export interface HallucinationFlag {
  vulnerabilityId: string
  risk: HallucinationRisk
  reasons: string[]
  crossValidation: CrossValidationResult
  cveVerification: CVEVerificationResult
}

export interface HallucinationReport {
  totalAnalysed: number
  lowRisk: number
  mediumRisk: number
  highRisk: number
  flags: HallucinationFlag[]
  overallTrustScore: number // 0-100, higher = more trustworthy
}

// ============================================
// 1. Cross-Validation: AI vs Keyword OWASP Mapping
// ============================================

/**
 * Compares the AI's OWASP category assignment against the deterministic
 * keyword-based mapping. Flags disagreements as potential hallucinations.
 */
export function crossValidateOWASP(
  vuln: VulnerabilityResult,
  aiAnalysis: VulnerabilityAnalysis
): CrossValidationResult {
  // Get deterministic keyword-based mappings
  const keywordMappings = mapVulnerabilityToOWASP(vuln)
  const keywordCategories = keywordMappings.map(m => m.category)

  // Parse AI's OWASP category (format: "A01:2021 - Category Name" or just "A01")
  const aiCategory = parseAIOWASPCategory(aiAnalysis.owaspCategory)

  // Check agreement
  const conflicts: string[] = []

  if (aiCategory && !keywordCategories.includes(aiCategory)) {
    const keywordLabels = keywordCategories.join(', ') || 'none'
    conflicts.push(
      `AI assigned ${aiCategory} but keyword matching found: ${keywordLabels}`
    )
  }

  if (!aiCategory && keywordCategories.length > 0) {
    conflicts.push(
      `AI provided no OWASP category but keywords matched: ${keywordCategories.join(', ')}`
    )
  }

  return {
    vulnerabilityId: vuln.id,
    keywordCategories,
    aiCategory,
    agreement: conflicts.length === 0,
    conflicts
  }
}

// ============================================
// 2. CVE Verification
// ============================================

/**
 * Checks if the AI referenced CVEs that were NOT found in the actual scan data.
 * Invented CVEs are a classic hallucination pattern.
 */
export function verifyCVEs(
  vuln: VulnerabilityResult,
  aiAnalysis: VulnerabilityAnalysis
): CVEVerificationResult {
  // Extract CVEs mentioned by AI across all text fields
  const aiText = [
    aiAnalysis.plainEnglishSummary,
    aiAnalysis.severityJustification,
    ...(aiAnalysis.remediationSteps || []),
    ...(aiAnalysis.affectedEndpoints || [])
  ].join(' ')

  const aiCVEs = extractCVEs(aiText)

  // Get CVEs from the actual scan data
  const scanCVEs: string[] = []
  if (vuln.cve) {
    scanCVEs.push(...extractCVEs(vuln.cve))
  }
  if (vuln.output) {
    scanCVEs.push(...extractCVEs(vuln.output))
  }
  if (vuln.description) {
    scanCVEs.push(...extractCVEs(vuln.description))
  }

  // Find CVEs the AI mentioned but weren't in scan data
  const uniqueScanCVEs = [...new Set(scanCVEs)]
  const uniqueAICVEs = [...new Set(aiCVEs)]
  const inventedCVEs = uniqueAICVEs.filter(cve => !uniqueScanCVEs.includes(cve))

  return {
    vulnerabilityId: vuln.id,
    aiMentionedCVEs: uniqueAICVEs,
    scanFoundCVEs: uniqueScanCVEs,
    inventedCVEs,
    verified: inventedCVEs.length === 0
  }
}

// ============================================
// 3. Hallucination Flagging
// ============================================

/**
 * Combines cross-validation and CVE verification into a single
 * hallucination risk assessment for each vulnerability analysis.
 */
export function assessHallucinationRisk(
  vuln: VulnerabilityResult,
  aiAnalysis: VulnerabilityAnalysis
): HallucinationFlag {
  const crossValidation = crossValidateOWASP(vuln, aiAnalysis)
  const cveVerification = verifyCVEs(vuln, aiAnalysis)

  const reasons: string[] = []

  // Factor 1: OWASP category disagreement
  if (!crossValidation.agreement) {
    reasons.push(...crossValidation.conflicts)
  }

  // Factor 2: Invented CVEs
  if (cveVerification.inventedCVEs.length > 0) {
    reasons.push(
      `AI referenced ${cveVerification.inventedCVEs.length} CVE(s) not found in scan data: ${cveVerification.inventedCVEs.join(', ')}`
    )
  }

  // Factor 3: AI confidence vs keyword confidence — scaled comparison
  // Map keyword confidence to a numeric range so we compare proportionally
  // instead of flagging any AI > 0.8 when keywords say "low"
  const keywordMappings = mapVulnerabilityToOWASP(vuln)
  const topKeywordConfidence = keywordMappings[0]?.confidence || 'low'
  const keywordScore = topKeywordConfidence === 'high' ? 0.9
                     : topKeywordConfidence === 'medium' ? 0.6
                     : 0.3
  const confidenceGap = aiAnalysis.confidenceScore - keywordScore
  if (confidenceGap > 0.5) {
    // Only flag when there's a LARGE gap (e.g., AI says 0.9 but keywords say 0.3)
    reasons.push(
      `AI confidence (${aiAnalysis.confidenceScore}) significantly exceeds keyword confidence (${topKeywordConfidence} ≈ ${keywordScore})`
    )
  }

  // Factor 4: Empty or generic remediation steps
  if (!aiAnalysis.remediationSteps || aiAnalysis.remediationSteps.length === 0) {
    reasons.push('AI provided no remediation steps')
  }

  // Calculate risk level
  let risk: HallucinationRisk
  if (cveVerification.inventedCVEs.length > 0) {
    // Invented CVEs are a strong hallucination signal
    risk = 'high'
  } else if (reasons.length >= 2) {
    risk = 'high'
  } else if (reasons.length === 1) {
    risk = 'medium'
  } else {
    risk = 'low'
  }

  return {
    vulnerabilityId: vuln.id,
    risk,
    reasons,
    crossValidation,
    cveVerification
  }
}

// ============================================
// 4. Full Report Generation
// ============================================

/**
 * Runs hallucination guard across all vulnerability analyses.
 * Returns a full report with per-vulnerability flags and overall trust score.
 */
export function generateHallucinationReport(
  vulnerabilities: VulnerabilityResult[],
  aiAnalyses: VulnerabilityAnalysis[]
): HallucinationReport {
  const flags: HallucinationFlag[] = []

  for (const vuln of vulnerabilities) {
    const aiAnalysis = aiAnalyses.find(a => a.vulnerabilityId === vuln.id)
    if (!aiAnalysis) continue

    flags.push(assessHallucinationRisk(vuln, aiAnalysis))
  }

  const lowRisk = flags.filter(f => f.risk === 'low').length
  const mediumRisk = flags.filter(f => f.risk === 'medium').length
  const highRisk = flags.filter(f => f.risk === 'high').length

  // Trust score: weighted by check type severity
  // Fabricated CVEs are critical (50 pts each) — hardcoded data is genuinely wrong
  // OWASP disagreements are subjective (5 pts each) — just a labelling difference
  // Confidence mismatches are least concerning (3 pts each) — both sides might be right
  let fabricatedCVECount = 0
  let owaspDisagreements = 0
  let confidenceMismatches = 0
  for (const flag of flags) {
    for (const reason of flag.reasons) {
      if (reason.includes('CVE') && reason.includes('not found in scan data')) {
        fabricatedCVECount++
      } else if (reason.includes('AI assigned') && reason.includes('keyword matching found')) {
        owaspDisagreements++
      } else if (reason.includes('confidence') && reason.includes('exceeds')) {
        confidenceMismatches++
      }
    }
  }
  const trustScore = Math.max(0, Math.min(100,
    100
    - (fabricatedCVECount * 50)
    - (owaspDisagreements * 5)
    - (confidenceMismatches * 3)
  ))

  return {
    totalAnalysed: flags.length,
    lowRisk,
    mediumRisk,
    highRisk,
    flags,
    overallTrustScore: trustScore
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Extracts CVE identifiers (CVE-YYYY-NNNNN) from text.
 */
function extractCVEs(text: string): string[] {
  const matches = text.match(/CVE-\d{4}-\d{4,}/gi) || []
  return matches.map(cve => cve.toUpperCase())
}

/**
 * Parses OWASP category from AI response formats.
 * Handles: "A01:2021 - Broken Access Control", "A03", "A01:2021", etc.
 */
function parseAIOWASPCategory(categoryStr: string | undefined): OWASPCategory | null {
  if (!categoryStr) return null

  const match = categoryStr.match(/A(0[1-9]|10)/i)
  if (!match) return null

  const code = `A${match[1]}` as string

  // Validate it's a real OWASP category
  const validCategories = Object.values(OWASPCategory) as string[]
  if (validCategories.includes(code)) {
    return code as OWASPCategory
  }

  return null
}
