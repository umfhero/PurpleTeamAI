// OWASP Top 10 mapper - maps vulnerabilities to OWASP categories

import type { VulnerabilityResult } from '../scanner/types'
import { OWASP_TOP_10, OWASPCategory, type OWASPMapping, type VulnerabilityWithMapping } from './owasp-types'

/**
 * Keyword weight map — high-specificity terms score more than generic ones.
 * Keywords not listed here default to weight 3 (medium specificity).
 */
const KEYWORD_WEIGHTS: Record<string, number> = {
  // Very specific — strong signal (weight 10)
  'sql injection': 10, 'sqli': 10, 'xss': 10, 'cross-site scripting': 10,
  'command injection': 10, 'code injection': 10, 'ldap injection': 10,
  'nosql injection': 10, 'xpath injection': 10, 'xml injection': 10,
  'ssrf': 10, 'server-side request forgery': 10, 'idor': 10,
  'insecure direct object reference': 10, 'insecure deserialization': 10,
  'path traversal': 10, 'directory traversal': 10, 'remote code execution': 10,
  'rce': 10, 'log4shell': 10, 'heartbleed': 10,
  'csrf': 8, 'cross-site request forgery': 8, 'clickjacking': 8,
  'session fixation': 8, 'session hijacking': 8, 'credential stuffing': 8,
  'privilege escalation': 8, 'brute force': 8,

  // Moderately specific (weight 5)
  'shell injection': 5, 'script injection': 5, 'template injection': 5,
  'header injection': 5, 'crlf injection': 5, 'eval injection': 5,
  'weak cipher': 5, 'weak hash': 5, 'weak encryption': 5,
  'cleartext': 5, 'plaintext password': 5, 'default credentials': 5,
  'default password': 5, 'misconfiguration': 5, 'auth bypass': 5,
  'hsts': 5, 'x-frame-options': 5, 'content-type-options': 5,
  'cors': 5, 'httponly': 5, 'samesite': 5, 'secure flag': 5,

  // Generic — could appear in many contexts (weight 1-2)
  'ssl': 2, 'tls': 2, 'https': 2, 'certificate': 2, 'crypto': 2,
  'authentication': 2, 'session': 2, 'password': 2, 'login': 2,
  'encryption': 2, 'log': 1, 'error': 1, 'component': 1,
  'dependency': 1, 'fetch': 1, 'audit': 1,
}

const DEFAULT_KEYWORD_WEIGHT = 3

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

  // Check each OWASP category for keyword matches with weighted scoring
  for (const category of Object.values(OWASP_TOP_10)) {
    const matches = category.keywords.filter(keyword =>
      searchText.includes(keyword.toLowerCase())
    )

    if (matches.length > 0) {
      // Weighted confidence: sum keyword weights instead of simple count
      const totalWeight = matches.reduce((sum, keyword) => {
        return sum + (KEYWORD_WEIGHTS[keyword.toLowerCase()] ?? DEFAULT_KEYWORD_WEIGHT)
      }, 0)

      // Confidence thresholds based on total weight
      const confidence = totalWeight >= 10 ? 'high'
                       : totalWeight >= 5 ? 'medium'
                       : 'low'

      mappings.push({
        category: category.id,
        confidence,
        reason: `Matched keywords (weight ${totalWeight}): ${matches.slice(0, 3).join(', ')}`
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

  // Missing HTTP security headers → A05 Security Misconfiguration
  if (/(missing.*header|x-frame|x-content-type|strict-transport|hsts|clickjack)/i.test(searchText)) {
    const existing = mappings.find(m => m.category === OWASPCategory.A05_SECURITY_MISCONFIGURATION)
    if (!existing) {
      mappings.push({
        category: OWASPCategory.A05_SECURITY_MISCONFIGURATION,
        confidence: 'high',
        reason: 'Missing HTTP security header detected'
      })
    } else if (existing.confidence !== 'high') {
      existing.confidence = 'high'
      existing.reason = 'Missing HTTP security header detected'
    }
  }

  // CSRF → A01 Broken Access Control
  if (/(csrf|cross-site request forgery|anti-forgery)/i.test(searchText)) {
    const existing = mappings.find(m => m.category === OWASPCategory.A01_BROKEN_ACCESS_CONTROL)
    if (!existing) {
      mappings.push({
        category: OWASPCategory.A01_BROKEN_ACCESS_CONTROL,
        confidence: 'high',
        reason: 'CSRF vulnerability detected'
      })
    }
  }

  // Information disclosure → A01 Broken Access Control
  if (/(information disclosure|directory listing|source code.*leak|version.*disclosure)/i.test(searchText)) {
    const existing = mappings.find(m => m.category === OWASPCategory.A01_BROKEN_ACCESS_CONTROL)
    if (!existing) {
      mappings.push({
        category: OWASPCategory.A01_BROKEN_ACCESS_CONTROL,
        confidence: 'high',
        reason: 'Information disclosure vulnerability detected'
      })
    }
  }

  // Cookie security issues → A05 Security Misconfiguration
  if (/(cookie.*secure|cookie.*httponly|session.*cookie|samesite)/i.test(searchText)) {
    const existing = mappings.find(m => m.category === OWASPCategory.A05_SECURITY_MISCONFIGURATION)
    if (!existing) {
      mappings.push({
        category: OWASPCategory.A05_SECURITY_MISCONFIGURATION,
        confidence: 'high',
        reason: 'Cookie security misconfiguration detected'
      })
    } else if (existing.confidence !== 'high') {
      existing.confidence = 'high'
      existing.reason = 'Cookie security misconfiguration detected'
    }
  }

  // Outdated software/version → A06 Vulnerable Components
  if (/(outdated.*(?:software|version|server)|end.of.life|eol|unsupported.*version|obsolete)/i.test(searchText)) {
    const existing = mappings.find(m => m.category === OWASPCategory.A06_VULNERABLE_COMPONENTS)
    if (!existing) {
      mappings.push({
        category: OWASPCategory.A06_VULNERABLE_COMPONENTS,
        confidence: 'high',
        reason: 'Outdated/vulnerable component detected'
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

  // Count ANY mapping (use highest confidence mapping per vulnerability)
  for (const mapping of mappings) {
    if (mapping.owaspMappings.length > 0) {
      // owaspMappings is already sorted by confidence (high > medium > low)
      uniqueCategories.add(mapping.owaspMappings[0].category)
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
