// Type definitions for Electron IPC API exposed via preload

export interface ScanResult {
  success: boolean
  message?: string
  data?: NmapScanData
}

export interface NmapScanData {
  target: string
  timestamp: string
  scanType: string
  ports: PortResult[]
  vulnerabilities: VulnerabilityResult[]
  rawXml?: string
  llmAnalysis?: LLMAnalysisResult
  securityScore?: SecurityScore
  owaspCoverage?: OWASPCoverage
  owaspDistribution?: Record<OWASPCategory, number>
}

export interface PortResult {
  port: number
  protocol: string
  state: string
  service: string
  version?: string
  product?: string
}

export interface VulnerabilityResult {
  id: string
  cve?: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  port?: number
  service?: string
  script?: string
  output?: string
}

export interface ValidationResult {
  allowed: boolean
  target: string
  requiresDisclaimer: boolean
  message?: string
}

export interface VulnerabilityAnalysis {
  vulnerabilityId: string
  plainEnglishSummary: string
  affectedEndpoints: string[]
  severityJustification: string
  remediationSteps: string[]
  owaspCategory?: string
  confidenceScore: number
}

export interface LLMAnalysisResult {
  success: boolean
  analyses: VulnerabilityAnalysis[]
  error?: string
  model?: string
  tokensUsed?: number
  processingTime?: number
  hallucinationReport?: HallucinationReport
}

// Hallucination Guard types
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
  overallTrustScore: number
}

// Hallucination Metrics types (empirical evaluation layer)
export interface HallucinationMetricsEntry {
  scanTimestamp: string
  target: string
  recordedAt: string
  owaspDisagreementRate: number
  owaspDisagreementCount: number
  fabricatedCVECount: number
  fabricatedCVEs: string[]
  confidenceMismatchRate: number
  confidenceMismatchCount: number
  trustScore: number
  totalAnalysed: number
  lowRisk: number
  mediumRisk: number
  highRisk: number
}

export interface HallucinationMetricsAggregate {
  totalScans: number
  meanOwaspDisagreementRate: number
  totalOwaspDisagreements: number
  totalFabricatedCVEs: number
  allFabricatedCVEs: string[]
  scansWithFabricatedCVEs: number
  meanConfidenceMismatchRate: number
  totalConfidenceMismatches: number
  meanTrustScore: number
  minTrustScore: number
  maxTrustScore: number
  trustScoreDistribution: {
    excellent: number
    good: number
    moderate: number
    poor: number
  }
  totalLowRisk: number
  totalMediumRisk: number
  totalHighRisk: number
  totalVulnsAnalysed: number
}

export interface LLMAnalysisRequest {
  vulnerabilities: Array<{
    id: string
    cve?: string
    title: string
    description: string
    severity: string
    port?: number
    service?: string
    output?: string
  }>
  target: string
  scanTimestamp: string
}

// OWASP Top 10 types
export type OWASPCategory = 'A01' | 'A02' | 'A03' | 'A04' | 'A05' | 'A06' | 'A07' | 'A08' | 'A09' | 'A10'

export interface OWASPCoverage {
  categories: OWASPCategory[]
  total: number
  percentage: number
}

// Security Score types
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
    severityImpact: number
    owaspCoverage: number
    remediationPotential: number
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

export interface ScanOptions {
  target: string
}

// Report types
export interface ReportOptions {
  scan: NmapScanData
  format: 'html' | 'pdf'
  includeRawData?: boolean
}

export interface ReportResult {
  success: boolean
  filePath?: string
  reportId?: string
  noChanges?: boolean
  error?: string
}

export interface ReportMetadata {
  id: string
  target: string
  scanTimestamp: string
  exportedAt: string
  filePath: string
  format: 'html' | 'pdf'
  vulnerabilityCount: number
  securityScore?: number
  grade?: string
}

// Delta Comparison types
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

export interface ElectronAPI {
  scanner: {
    runNmap: (options: ScanOptions) => Promise<ScanResult>
    getHistory: () => Promise<NmapScanData[]>
    getGroupedHistory: () => Promise<TargetGroup[]>
    getDeltas: (target: string) => Promise<ScanDeltaChain>
    validateTarget: (target: string) => Promise<ValidationResult>
    abort: () => Promise<{ success: boolean; message: string }>
    deleteScan: (timestamp: string) => Promise<{ success: boolean; message?: string }>
    saveScan: (scanData: NmapScanData) => Promise<{ success: boolean; error?: string }>
    onProgress: (callback: (line: string) => void) => () => void
    onPhaseResult: (callback: (data: NmapScanData) => void) => () => void
  }
  llm: {
    analyzeVulnerabilities: (request: LLMAnalysisRequest) => Promise<LLMAnalysisResult>
  }
  report: {
    export: (options: ReportOptions) => Promise<ReportResult>
    exportPentest: (scan: NmapScanData) => Promise<ReportResult>
    generatePentest: (scan: NmapScanData) => Promise<ReportResult>
    generateDelta: (olderTs: string, newerTs: string) => Promise<ReportResult>
    exportDelta: (olderTs: string, newerTs: string) => Promise<ReportResult>
    getHistory: () => Promise<ReportMetadata[]>
    open: (id: string) => Promise<boolean>
    openFile: (filePath: string) => Promise<boolean>
    readPdf: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>
    delete: (id: string, deleteFile: boolean) => Promise<boolean>
  }
  hallucination: {
    getMetricsHistory: () => Promise<HallucinationMetricsEntry[]>
    getMetricsAggregate: () => Promise<HallucinationMetricsAggregate>
  }
  versions: {
    node: string
    chrome: string
    electron: string
  }
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export { }
