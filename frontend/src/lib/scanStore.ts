// Global scan state store - persists across page navigation
// This is a simple singleton store that keeps scan state when navigating away

import type { NmapScanData } from '../types/electron'

export type ScanState = 'idle' | 'validating' | 'confirming' | 'scanning' | 'analyzing' | 'complete' | 'error'
export type ScanType = 'quick' | 'vuln' | 'full'

interface ScanStore {
  // Scan state
  state: ScanState
  target: string
  scanType: ScanType
  logs: string[]
  result: NmapScanData | null
  error: string | null
  
  // Progress listener cleanup function
  progressCleanup: (() => void) | null
  
  // Subscribers for state changes
  subscribers: Set<() => void>
}

// Initial state
const store: ScanStore = {
  state: 'idle',
  target: '',
  scanType: 'quick',
  logs: [],
  result: null,
  error: null,
  progressCleanup: null,
  subscribers: new Set(),
}

// Subscribe to state changes
export function subscribeScanStore(callback: () => void): () => void {
  store.subscribers.add(callback)
  return () => store.subscribers.delete(callback)
}

// Notify all subscribers
function notifySubscribers() {
  store.subscribers.forEach(cb => cb())
}

// Getters
export function getScanState() {
  return {
    state: store.state,
    target: store.target,
    scanType: store.scanType,
    logs: store.logs,
    result: store.result,
    error: store.error,
  }
}

// Actions
export function setScanState(state: ScanState) {
  store.state = state
  notifySubscribers()
}

export function setScanTarget(target: string) {
  store.target = target
  notifySubscribers()
}

export function setScanType(scanType: ScanType) {
  store.scanType = scanType
  notifySubscribers()
}

export function addScanLog(log: string) {
  store.logs = [...store.logs, log]
  notifySubscribers()
}

export function setScanLogs(logs: string[]) {
  store.logs = logs
  notifySubscribers()
}

export function setScanResult(result: NmapScanData | null) {
  store.result = result
  notifySubscribers()
}

export function setScanError(error: string | null) {
  store.error = error
  notifySubscribers()
}

export function setProgressCleanup(cleanup: (() => void) | null) {
  // Clean up previous listener if exists
  if (store.progressCleanup) {
    store.progressCleanup()
  }
  store.progressCleanup = cleanup
}

export function resetScanStore() {
  // Clean up progress listener
  if (store.progressCleanup) {
    store.progressCleanup()
    store.progressCleanup = null
  }
  
  store.state = 'idle'
  store.target = ''
  store.scanType = 'quick'
  store.logs = []
  store.result = null
  store.error = null
  notifySubscribers()
}

// Check if a scan is currently active
export function isScanActive(): boolean {
  return store.state === 'scanning' || store.state === 'analyzing' || store.state === 'validating'
}
