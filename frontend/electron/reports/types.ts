import type { NmapScanData } from '../scanner/types'

export interface ReportOptions {
  scan: NmapScanData
  format: 'html' | 'pdf'
  includeRawData?: boolean
}

export interface ReportResult {
  success: boolean
  filePath?: string
  reportId?: string
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
