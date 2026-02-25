// Delta comparison engine — computes resolved/new/persisting vulns between sequential scans

import type { NmapScanData, VulnerabilityResult } from '../scanner/types'
import type { ScanDelta, ScanDeltaChain, OWASPDeltaEntry, TargetGroup, VulnerabilityFingerprint } from './delta-types'
import { OWASPCategory } from './owasp-types'

// ---------------------------------------------------------------------------
// Fingerprinting
// ---------------------------------------------------------------------------

/**
 * Generate a stable composite key for a vulnerability across different scan runs.
 * We cannot use the `id` field because it is counter-based (http-csrf-2, etc.)
 * and will differ between scans even for the same finding.
 */
export function fingerprintVulnerability(vuln: VulnerabilityResult): string {
  const script = (vuln.script ?? '').trim().toLowerCase()
  const title = (vuln.title ?? '').trim().toLowerCase()
  const port = vuln.port != null ? String(vuln.port) : ''
  const cve = (vuln.cve ?? '').trim().toLowerCase()

  // CVE match takes priority — two vulns with the same CVE on the same port are the same finding
  if (cve && port) return `cve:${cve}|port:${port}`
  if (cve) return `cve:${cve}`

  // Fall back to script + title + port
  return `script:${script}|title:${title}|port:${port}`
}

function buildFingerprintMap(vulns: VulnerabilityResult[]): Map<string, VulnerabilityFingerprint> {
  const map = new Map<string, VulnerabilityFingerprint>()
  for (const vuln of vulns) {
    const key = fingerprintVulnerability(vuln)
    if (!map.has(key)) {
      map.set(key, { key, vuln })
    }
  }
  return map
}

// ---------------------------------------------------------------------------
// Single-pair comparison
// ---------------------------------------------------------------------------

/**
 * Compare two sequential scans and produce a ScanDelta.
 * @param older The earlier scan
 * @param newer The more recent scan
 */
export function compareScanPair(older: NmapScanData, newer: NmapScanData): ScanDelta {
  const olderMap = buildFingerprintMap(older.vulnerabilities ?? [])
  const newerMap = buildFingerprintMap(newer.vulnerabilities ?? [])

  const resolved: VulnerabilityResult[] = []
  const newVulns: VulnerabilityResult[] = []
  const persisting: VulnerabilityResult[] = []

  // Vulns in older scan
  for (const [key, fp] of olderMap) {
    if (newerMap.has(key)) {
      persisting.push(fp.vuln)
    } else {
      resolved.push(fp.vuln)
    }
  }

  // Vulns in newer scan not in older
  for (const [key, fp] of newerMap) {
    if (!olderMap.has(key)) {
      newVulns.push(fp.vuln)
    }
  }

  // Score comparison
  const olderScore = older.securityScore?.overall ?? 0
  const newerScore = newer.securityScore?.overall ?? 0
  const scoreChange = newerScore - olderScore

  // OWASP distribution comparison
  const owaspDelta = computeOWASPDelta(
    older.owaspDistribution ?? {},
    newer.owaspDistribution ?? {}
  )

  const hasChanges = resolved.length > 0 || newVulns.length > 0 || owaspDelta.some(e => e.change !== 0)

  return {
    olderTimestamp: older.timestamp,
    newerTimestamp: newer.timestamp,
    olderScore,
    newerScore,
    scoreChange,
    resolved,
    newVulns,
    persisting,
    owaspDelta,
    hasChanges
  }
}

// ---------------------------------------------------------------------------
// OWASP delta
// ---------------------------------------------------------------------------

function computeOWASPDelta(
  older: Partial<Record<OWASPCategory, number>>,
  newer: Partial<Record<OWASPCategory, number>>
): OWASPDeltaEntry[] {
  const categories = Object.values(OWASPCategory) as OWASPCategory[]
  const result: OWASPDeltaEntry[] = []

  for (const category of categories) {
    const oldCount = older[category] ?? 0
    const newCount = newer[category] ?? 0
    if (oldCount !== 0 || newCount !== 0) {
      result.push({ category, oldCount, newCount, change: newCount - oldCount })
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Full chain computation
// ---------------------------------------------------------------------------

/**
 * Given all scans for one target (any order), compute all sequential deltas.
 * Only pairs where scans have actual differences will have `hasChanges: true`.
 */
export function computeAllDeltas(scans: NmapScanData[]): ScanDeltaChain {
  const target = scans[0]?.target ?? ''

  // Sort chronologically oldest-to-newest
  const sorted = [...scans].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const deltas: ScanDelta[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    deltas.push(compareScanPair(sorted[i], sorted[i + 1]))
  }

  return { target, deltas }
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Group a flat list of scans by target URL.
 * Groups are sorted alphabetically by target.
 * Scans within each group are sorted newest-first.
 */
export function groupScansByTarget(scans: NmapScanData[]): TargetGroup[] {
  const map = new Map<string, NmapScanData[]>()

  for (const scan of scans) {
    const key = scan.target
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(scan)
  }

  const groups: TargetGroup[] = []

  for (const [target, groupScans] of map) {
    // Newest-first
    const sorted = [...groupScans].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    const latest = sorted[0]
    groups.push({
      target,
      scans: sorted,
      count: sorted.length,
      latestScore: latest?.securityScore?.overall,
      latestGrade: latest?.securityScore?.grade
    })
  }

  // Alphabetical by target
  groups.sort((a, b) => a.target.localeCompare(b.target))

  return groups
}
