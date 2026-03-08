// Scanner module types
import type { SecurityScore, OWASPCoverage, OWASPCategory } from '../analysis/owasp-types'

export interface NmapScanData {
  target: string
  timestamp: string
  scanType: string
  ports: PortResult[]
  vulnerabilities: VulnerabilityResult[]
  rawXml?: string
  llmAnalysis?: any // To avoid circular dependency, use any here
  securityScore?: SecurityScore
  owaspCoverage?: OWASPCoverage
  owaspDistribution?: Record<OWASPCategory, number>
  featureToggles?: {
    owaspMapping: boolean
    aiAnalysis: boolean
    hallucinationGuard: boolean
    contextualWeighting: boolean
    deltaComparison: boolean
  }
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

export interface ScanResult {
  success: boolean
  message?: string
  data?: NmapScanData
}

export interface ValidationResult {
  allowed: boolean
  target: string
}
