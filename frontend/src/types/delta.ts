// Frontend-side mirror of delta comparison types (matches electron/analysis/delta-types.ts)
// These are used by Dashboard.tsx, Reports.tsx, and ScanGroupSidebar.tsx

import type { VulnerabilityResult, OWASPCategory, NmapScanData } from './electron'

export interface OWASPDeltaEntry {
  category: OWASPCategory
  oldCount: number
  newCount: number
  change: number
}

export interface ScanDelta {
  olderTimestamp: string
  newerTimestamp: string
  olderScore: number
  newerScore: number
  scoreChange: number
  resolved: VulnerabilityResult[]
  newVulns: VulnerabilityResult[]
  persisting: VulnerabilityResult[]
  owaspDelta: OWASPDeltaEntry[]
  hasChanges: boolean
}

export interface ScanDeltaChain {
  target: string
  deltas: ScanDelta[]
}

export interface TargetGroup {
  target: string
  scans: NmapScanData[]
  count: number
  latestScore?: number
  latestGrade?: string
}
