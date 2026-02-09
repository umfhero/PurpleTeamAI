// OWASP Top 10 mapper - maps vulnerabilities to OWASP categories

import type { VulnerabilityResult } from '../scanner/types'
import { OWASP_TOP_10, OWASPCategory, type OWASPMapping, type VulnerabilityWithMapping } from './owasp-types'

/**
 * Maps a vulnerability to OWASP Top 10 categories using keyword matching.
 * Returns array of possible mappings sorted by confidence.
 */
export function mapVulnerabilityToOWASP(vuln: VulnerabilityResult): OWASPMapping[] {
  const mappings: OWASPMapping[] = []
  
  // Combine all text fields for matching
  const searchText = [
    vuln.title,
    vuln.description,
    vuln.cve || '',
    vuln.service || '',
    vuln.output || ''
  ].join(' ').toLowerCase()

  // Check each OWASP category for keyword matches
  for (const category of Object.values(OWASP_TOP_10)) {
    const matches = category.keywords.filter(keyword => 
      searchText.includes(keyword.toLowerCase())
    )

    if (matches.length > 0) {
      // Confidence based on number of keyword matches
      const confidence = matches.length >= 3 ? 'high' 
                       : matches.length >= 2 ? 'medium' 
                       : 'low'
      
      mappings.push({
        category: category.id,
        confidence,
        reason: `Matched keywords: ${matches.slice(0, 3).join(', ')}`
      })
    }
  }

  // Special handling for specific vulnerability types
  
  // SQL Injection - always A03
  if (/(sql|sqli|mysql|postgresql|database query)/i.test(searchText)) {
    const existing = mappings.find(m => m.category === OWASPCategory.A03_INJECTION)
    if (!existing) {
      mappings.push({
        category: OWASPCategory.A03_INJECTION,
        confidence: 'high',
        reason: 'SQL-related vulnerability detected'
      })
    }
  }

  // XSS - always A03
  if (/(xss|cross-site|script injection)/i.test(searchText)) {
    const existing = mappings.find(m => m.category === OWASPCategory.A03_INJECTION)
    if (!existing) {
      mappings.push({
        category: OWASPCategory.A03_INJECTION,
        confidence: 'high',
        reason: 'XSS vulnerability detected'
      })
    }
  }

  // Path traversal - A01
  if (/(path traversal|directory traversal|\.\.\/)/i.test(searchText)) {
    const existing = mappings.find(m => m.category === OWASPCategory.A01_BROKEN_ACCESS_CONTROL)
    if (!existing) {
      mappings.push({
        category: OWASPCategory.A01_BROKEN_ACCESS_CONTROL,
        confidence: 'high',
        reason: 'Path traversal vulnerability'
      })
    }
  }

  // Weak SSL/TLS - A02
  if (/(sslv2|sslv3|weak cipher|tls 1.0|tls 1.1)/i.test(searchText)) {
    const existing = mappings.find(m => m.category === OWASPCategory.A02_CRYPTOGRAPHIC_FAILURES)
    if (!existing) {
      mappings.push({
        category: OWASPCategory.A02_CRYPTOGRAPHIC_FAILURES,
        confidence: 'high',
        reason: 'Weak cryptographic protocol detected'
      })
    }
  }

  // If we have CVE but no mappings, default to A06 (Vulnerable Components)
  if (mappings.length === 0 && vuln.cve) {
    mappings.push({
      category: OWASPCategory.A06_VULNERABLE_COMPONENTS,
      confidence: 'medium',
      reason: 'CVE identified - likely vulnerable component'
    })
  }

  // Default fallback to A05 (Security Misconfiguration) if nothing else matched
  if (mappings.length === 0) {
    mappings.push({
      category: OWASPCategory.A05_SECURITY_MISCONFIGURATION,
      confidence: 'low',
      reason: 'No specific category match - general misconfiguration'
    })
  }

  // Sort by confidence (high > medium > low)
  const confidenceOrder = { high: 3, medium: 2, low: 1 }
  return mappings.sort((a, b) => confidenceOrder[b.confidence] - confidenceOrder[a.confidence])
}

/**
 * Maps all vulnerabilities in a scan to OWASP categories.
 */
export function mapAllVulnerabilities(vulnerabilities: VulnerabilityResult[]): VulnerabilityWithMapping[] {
  return vulnerabilities.map(vuln => ({
    vulnerabilityId: vuln.id,
    owaspMappings: mapVulnerabilityToOWASP(vuln)
  }))
}

/**
 * Gets unique OWASP categories found in the scan.
 */
export function getOWASPCoverage(vulnerabilities: VulnerabilityResult[]): {
  categories: OWASPCategory[]
  total: number
  percentage: number
} {
  const mappings = mapAllVulnerabilities(vulnerabilities)
  const uniqueCategories = new Set<OWASPCategory>()

  // Only count high-confidence mappings for coverage
  for (const mapping of mappings) {
    const highConfidenceMapping = mapping.owaspMappings.find(m => m.confidence === 'high')
    if (highConfidenceMapping) {
      uniqueCategories.add(highConfidenceMapping.category)
    }
  }

  return {
    categories: Array.from(uniqueCategories).sort(),
    total: uniqueCategories.size,
    percentage: Math.round((uniqueCategories.size / 10) * 100)
  }
}

/**
 * Gets distribution of vulnerabilities across OWASP categories.
 */
export function getOWASPDistribution(vulnerabilities: VulnerabilityResult[]): Record<OWASPCategory, number> {
  const distribution: Record<string, number> = {}
  const mappings = mapAllVulnerabilities(vulnerabilities)

  // Initialize all categories with 0
  for (const category of Object.values(OWASPCategory)) {
    distribution[category] = 0
  }

  // Count vulnerabilities per category (using highest confidence mapping)
  for (const mapping of mappings) {
    if (mapping.owaspMappings.length > 0) {
      const primaryCategory = mapping.owaspMappings[0].category
      distribution[primaryCategory]++
    }
  }

  return distribution as Record<OWASPCategory, number>
}
