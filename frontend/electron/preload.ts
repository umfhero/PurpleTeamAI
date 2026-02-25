import { contextBridge, ipcRenderer } from 'electron'

// Expose secure APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Scanner APIs
  scanner: {
    runNmap: (options: unknown) => ipcRenderer.invoke('scanner:run-nmap', options),
    getHistory: () => ipcRenderer.invoke('scanner:get-history'),
    getGroupedHistory: () => ipcRenderer.invoke('scanner:get-grouped-history'),
    getDeltas: (target: string) => ipcRenderer.invoke('scanner:get-deltas', target),
    validateTarget: (target: string) => ipcRenderer.invoke('scanner:validate-target', target),
    abort: () => ipcRenderer.invoke('scanner:abort'),
    deleteScan: (timestamp: string) => ipcRenderer.invoke('scanner:delete-scan', timestamp),
    onProgress: (callback: (line: string) => void) => {
      const listener = (_event: unknown, line: string) => callback(line)
      ipcRenderer.on('scanner:progress', listener)
      // Return cleanup function
      return () => ipcRenderer.removeListener('scanner:progress', listener)
    },
    onPhaseResult: (callback: (data: unknown) => void) => {
      const listener = (_event: unknown, data: unknown) => callback(data)
      ipcRenderer.on('scanner:phase-result', listener)
      return () => ipcRenderer.removeListener('scanner:phase-result', listener)
    },
  },

  // LLM APIs
  llm: {
    analyzeVulnerabilities: (request: unknown) => ipcRenderer.invoke('llm:analyze-vulnerabilities', request),
  },

  // Report APIs
  report: {
    export: (options: unknown) => ipcRenderer.invoke('report:export', options),
    exportPentest: (scan: unknown) => ipcRenderer.invoke('report:export-pentest', scan),
    generatePentest: (scan: unknown) => ipcRenderer.invoke('report:generate-pentest', scan),
    generateDelta: (olderTs: string, newerTs: string) => ipcRenderer.invoke('report:generate-delta', olderTs, newerTs),
    exportDelta: (olderTs: string, newerTs: string) => ipcRenderer.invoke('report:export-delta', olderTs, newerTs),
    getHistory: () => ipcRenderer.invoke('report:get-history'),
    open: (id: string) => ipcRenderer.invoke('report:open', id),
    openFile: (filePath: string) => ipcRenderer.invoke('report:open-file', filePath),
    readPdf: (filePath: string) => ipcRenderer.invoke('report:read-pdf', filePath),
    delete: (id: string, deleteFile: boolean) => ipcRenderer.invoke('report:delete', id, deleteFile),
  },

  // App info
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  // Window controls (for frameless window)
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  },
})

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      scanner: {
        runNmap: (target: string) => Promise<{ success: boolean; message?: string; data?: unknown }>
        getHistory: () => Promise<unknown[]>
        validateTarget: (target: string) => Promise<{ allowed: boolean; target: string; requiresDisclaimer: boolean }>
      }
      versions: {
        node: string
        chrome: string
        electron: string
      }
      windowControls: {
        minimize: () => Promise<void>
        maximize: () => Promise<void>
        close: () => Promise<void>
        isMaximized: () => Promise<boolean>
      }
    }
  }
}
