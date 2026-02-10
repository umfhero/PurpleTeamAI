// Custom hook to use the global scan store with React state
import { useState, useEffect, useCallback } from 'react'
import {
  subscribeScanStore,
  getScanState,
  setScanState as setStoreScanState,
  setScanTarget as setStoreTarget,
  addScanLog,
  setScanLogs as setStoreLogs,
  setScanResult as setStoreResult,
  setScanError as setStoreError,
  setProgressCleanup,
  setPhaseCleanup,
  resetScanStore,
  type ScanState,
} from './scanStore'
import type { NmapScanData } from '../types/electron'

export function useScanStore() {
  // Local state that syncs with global store
  const [state, setState] = useState(getScanState)

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = subscribeScanStore(() => {
      setState(getScanState())
    })
    return unsubscribe
  }, [])

  // Memoized setters that update both local and global state
  const setScanState = useCallback((newState: ScanState) => {
    setStoreScanState(newState)
  }, [])

  const setTarget = useCallback((target: string) => {
    setStoreTarget(target)
  }, [])

  const setScanLogs = useCallback((logs: string[]) => {
    setStoreLogs(logs)
  }, [])

  const appendLog = useCallback((log: string) => {
    addScanLog(log)
  }, [])

  const setScanResult = useCallback((result: NmapScanData | null) => {
    setStoreResult(result)
  }, [])

  const setScanError = useCallback((error: string | null) => {
    setStoreError(error)
  }, [])

  const reset = useCallback(() => {
    resetScanStore()
  }, [])

  return {
    // State
    scanState: state.state,
    target: state.target,
    scanLogs: state.logs,
    scanResult: state.result,
    error: state.error,

    // Actions
    setScanState,
    setTarget,
    setScanLogs,
    appendLog,
    setScanResult,
    setScanError,
    setProgressCleanup,
    setPhaseCleanup,
    reset,
  }
}
