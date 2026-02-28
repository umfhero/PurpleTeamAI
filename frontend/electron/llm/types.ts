// Type definitions for LLM analysis

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

export interface VulnerabilityAnalysis {
  vulnerabilityId: string
  plainEnglishSummary: string
  affectedEndpoints: string[]
  severityJustification: string
  remediationSteps: string[]
  owaspCategory?: string
  confidenceScore: number // 0-1
}

export interface LLMAnalysisResult {
  success: boolean
  analyses: VulnerabilityAnalysis[]
  error?: string
  model?: string
  tokensUsed?: number
  processingTime?: number
  hallucinationReport?: import('../analysis/hallucination-guard').HallucinationReport
}

export interface GeminiConfig {
  apiKey: string
  fallbackApiKey?: string
  model?: string
  maxRetries?: number
  timeout?: number
}
