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
  message?: string
}

export interface ElectronAPI {
  scanner: {
    runNmap: (target: string) => Promise<ScanResult>
    getHistory: () => Promise<NmapScanData[]>
    validateTarget: (target: string) => Promise<ValidationResult>
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

export {}
