// Global scan state store - persists across page navigation
// This is a simple singleton store that keeps scan state when navigating away

import type { NmapScanData } from '../types/electron'

export type ScanState = 'idle' | 'validating' | 'confirming' | 'scanning' | 'deepening' | 'analyzing' | 'complete' | 'error'

interface ScanStore {
  // Scan state
  state: ScanState
  target: string
  logs: string[]
  result: NmapScanData | null
  error: string | null
  
  // Progress listener cleanup function
  progressCleanup: (() => void) | null
  
  // Phase result listener cleanup
  phaseCleanup: (() => void) | null
  
  // Subscribers for state changes
  subscribers: Set<() => void>
}

// Initial state
const store: ScanStore = {
  state: 'idle',
  target: '',
  logs: [],
  result: null,
  error: null,
  progressCleanup: null,
  phaseCleanup: null,
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

export function setPhaseCleanup(cleanup: (() => void) | null) {
  if (store.phaseCleanup) {
    store.phaseCleanup()
  }
  store.phaseCleanup = cleanup
}

export function resetScanStore() {
  // Clean up listeners
  if (store.progressCleanup) {
    store.progressCleanup()
    store.progressCleanup = null
  }
  if (store.phaseCleanup) {
    store.phaseCleanup()
    store.phaseCleanup = null
  }
  
  store.state = 'idle'
  store.target = ''
  store.logs = []
  store.result = null
  store.error = null
  notifySubscribers()
}

// Check if a scan is currently active
export function isScanActive(): boolean {
  return store.state === 'scanning' || store.state === 'analyzing' || store.state === 'validating'
}
