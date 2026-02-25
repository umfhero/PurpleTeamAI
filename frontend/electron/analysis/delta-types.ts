// Delta comparison types — used by delta-comparison.ts and delta-report-generator.ts

import type { VulnerabilityResult } from '../scanner/types'
import type { OWASPCategory } from './owasp-types'

/** Stable identity key for a vulnerability across scans */
export interface VulnerabilityFingerprint {
  key: string
  vuln: VulnerabilityResult
}

/** Change delta for a single OWASP category between two scans */
export interface OWASPDeltaEntry {
  category: OWASPCategory
  oldCount: number
  newCount: number
  change: number // newCount - oldCount, negative = improvement
}

/** The computed difference between two sequential scans of the same target */
export interface ScanDelta {
  olderTimestamp: string
  newerTimestamp: string
  olderScore: number
  newerScore: number
  scoreChange: number // positive = improvement, negative = degradation
  resolved: VulnerabilityResult[] // in older, not in newer — fixed
  newVulns: VulnerabilityResult[] // in newer, not in older — regressions
  persisting: VulnerabilityResult[] // in both scans — unresolved
  owaspDelta: OWASPDeltaEntry[]
  hasChanges: boolean // false when resolved, new, and owaspDelta are all empty
}

/** All sequential scan deltas for a single target */
export interface ScanDeltaChain {
  target: string
  deltas: ScanDelta[] // ordered oldest-to-newest pair
}

/** A group of all scans sharing the same target URL */
export interface TargetGroup {
  target: string
  scans: import('../scanner/types').NmapScanData[] // newest-first order
  count: number
  latestScore?: number
  latestGrade?: string
}
