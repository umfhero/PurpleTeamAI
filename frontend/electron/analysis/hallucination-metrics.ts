// Hallucination Metrics — Empirical evaluation layer for LLM hallucination tracking
// Extracts structured metrics from hallucination reports and persists them for cross-scan analysis.

import fs from 'node:fs/promises'
import path from 'node:path'
import type { HallucinationReport } from './hallucination-guard'
import { getMetricsPath } from '../paths'

// ============================================
// Types
// ============================================

/** One entry per LLM analysis run. Captures the 4 key metrics. */
export interface HallucinationMetricsEntry {
  // Identity
  scanTimestamp: string
  target: string
  recordedAt: string

  // Metric 1: OWASP classification disagreement rate
  owaspDisagreementRate: number    // 0–1, fraction of vulns where AI ≠ keyword mapping
  owaspDisagreementCount: number

  // Metric 2: Fabricated CVE detection
  fabricatedCVECount: number
  fabricatedCVEs: string[]

  // Metric 3: Confidence mismatch frequency
  confidenceMismatchRate: number   // 0–1, fraction of vulns with AI high / keyword low
  confidenceMismatchCount: number

  // Metric 4: Trust score
  trustScore: number               // 0–100

  // Context
  totalAnalysed: number
  lowRisk: number
  mediumRisk: number
  highRisk: number
}

/** Aggregated statistics across all metric entries. */
export interface HallucinationMetricsAggregate {
  totalScans: number

  // Metric 1 aggregate
  meanOwaspDisagreementRate: number
  totalOwaspDisagreements: number

  // Metric 2 aggregate
  totalFabricatedCVEs: number
  allFabricatedCVEs: string[]
  scansWithFabricatedCVEs: number

  // Metric 3 aggregate
  meanConfidenceMismatchRate: number
  totalConfidenceMismatches: number

  // Metric 4 aggregate
  meanTrustScore: number
  minTrustScore: number
  maxTrustScore: number
  trustScoreDistribution: {
    excellent: number  // 90–100
    good: number       // 70–89
    moderate: number   // 50–69
    poor: number       // 0–49
  }

  // Risk distribution totals
  totalLowRisk: number
  totalMediumRisk: number
  totalHighRisk: number
  totalVulnsAnalysed: number
}

// ============================================
// Data Directory
// ============================================

// Metrics file path — resolved at call time via shared paths module
function getMetricsFilePath(): string {
  return getMetricsPath()
}

// ============================================
// Metrics Extraction
// ============================================

/**
 * Extract structured metrics from a hallucination report.
 * Called immediately after generateHallucinationReport() in main.ts.
 */
export function extractMetrics(
  report: HallucinationReport,
  scanTimestamp: string,
  target: string
): HallucinationMetricsEntry {
  const flags = report.flags

  // Metric 1: OWASP disagreement rate
  const owaspDisagreements = flags.filter(f => !f.crossValidation.agreement)
  const owaspDisagreementRate = report.totalAnalysed > 0
    ? owaspDisagreements.length / report.totalAnalysed
    : 0

  // Metric 2: Fabricated CVEs
  const allFabricated = flags.flatMap(f => f.cveVerification.inventedCVEs)

  // Metric 3: Confidence mismatch
  const confidenceMismatches = flags.filter(f =>
    f.reasons.some(r => r.includes('high confidence') && r.includes('low confidence'))
  )
  const confidenceMismatchRate = report.totalAnalysed > 0
    ? confidenceMismatches.length / report.totalAnalysed
    : 0

  return {
    scanTimestamp,
    target,
    recordedAt: new Date().toISOString(),
    owaspDisagreementRate,
    owaspDisagreementCount: owaspDisagreements.length,
    fabricatedCVECount: allFabricated.length,
    fabricatedCVEs: [...new Set(allFabricated)],
    confidenceMismatchRate,
    confidenceMismatchCount: confidenceMismatches.length,
    trustScore: report.overallTrustScore,
    totalAnalysed: report.totalAnalysed,
    lowRisk: report.lowRisk,
    mediumRisk: report.mediumRisk,
    highRisk: report.highRisk,
  }
}

// ============================================
// Persistence
// ============================================

/**
 * Append a metrics entry to the JSON file.
 * Creates the file if it doesn't exist.
 */
export async function saveMetricsEntry(entry: HallucinationMetricsEntry): Promise<void> {
  const metricsPath = getMetricsFilePath()
  console.log(`[HallucinationMetrics] Attempting to save metrics to: ${metricsPath}`)
  try {
    await fs.mkdir(path.dirname(metricsPath), { recursive: true })

    let entries: HallucinationMetricsEntry[] = []
    try {
      const existing = await fs.readFile(metricsPath, 'utf-8')
      entries = JSON.parse(existing)
    } catch {
      // File doesn't exist yet
    }

    // Prevent duplicate entries for the same scan
    const alreadyExists = entries.some(e => e.scanTimestamp === entry.scanTimestamp)
    if (!alreadyExists) {
      entries.push(entry)
    }

    await fs.writeFile(metricsPath, JSON.stringify(entries, null, 2), 'utf-8')
    console.log(`[HallucinationMetrics] Saved metrics for scan ${entry.scanTimestamp} (trust=${entry.trustScore})`)
  } catch (error) {
    console.error('[HallucinationMetrics] Failed to save metrics:', error)
  }
}

/**
 * Load all metrics entries from disk.
 */
export async function loadMetricsHistory(): Promise<HallucinationMetricsEntry[]> {
  try {
    const data = await fs.readFile(getMetricsFilePath(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

// ============================================
// Aggregation
// ============================================

/**
 * Compute aggregate statistics across all metrics entries.
 */
export function aggregateMetrics(entries: HallucinationMetricsEntry[]): HallucinationMetricsAggregate {
  if (entries.length === 0) {
    return {
      totalScans: 0,
      meanOwaspDisagreementRate: 0,
      totalOwaspDisagreements: 0,
      totalFabricatedCVEs: 0,
      allFabricatedCVEs: [],
      scansWithFabricatedCVEs: 0,
      meanConfidenceMismatchRate: 0,
      totalConfidenceMismatches: 0,
      meanTrustScore: 0,
      minTrustScore: 0,
      maxTrustScore: 0,
      trustScoreDistribution: { excellent: 0, good: 0, moderate: 0, poor: 0 },
      totalLowRisk: 0,
      totalMediumRisk: 0,
      totalHighRisk: 0,
      totalVulnsAnalysed: 0,
    }
  }

  const n = entries.length
  const trustScores = entries.map(e => e.trustScore)

  return {
    totalScans: n,
    meanOwaspDisagreementRate: entries.reduce((s, e) => s + e.owaspDisagreementRate, 0) / n,
    totalOwaspDisagreements: entries.reduce((s, e) => s + e.owaspDisagreementCount, 0),
    totalFabricatedCVEs: entries.reduce((s, e) => s + e.fabricatedCVECount, 0),
    allFabricatedCVEs: [...new Set(entries.flatMap(e => e.fabricatedCVEs))],
    scansWithFabricatedCVEs: entries.filter(e => e.fabricatedCVECount > 0).length,
    meanConfidenceMismatchRate: entries.reduce((s, e) => s + e.confidenceMismatchRate, 0) / n,
    totalConfidenceMismatches: entries.reduce((s, e) => s + e.confidenceMismatchCount, 0),
    meanTrustScore: trustScores.reduce((s, t) => s + t, 0) / n,
    minTrustScore: Math.min(...trustScores),
    maxTrustScore: Math.max(...trustScores),
    trustScoreDistribution: {
      excellent: trustScores.filter(t => t >= 90).length,
      good: trustScores.filter(t => t >= 70 && t < 90).length,
      moderate: trustScores.filter(t => t >= 50 && t < 70).length,
      poor: trustScores.filter(t => t < 50).length,
    },
    totalLowRisk: entries.reduce((s, e) => s + e.lowRisk, 0),
    totalMediumRisk: entries.reduce((s, e) => s + e.mediumRisk, 0),
    totalHighRisk: entries.reduce((s, e) => s + e.highRisk, 0),
    totalVulnsAnalysed: entries.reduce((s, e) => s + e.totalAnalysed, 0),
  }
}
