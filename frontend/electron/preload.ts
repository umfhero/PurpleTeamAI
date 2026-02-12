import { contextBridge, ipcRenderer } from 'electron'

// Expose secure APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Scanner APIs
  scanner: {
    runNmap: (options: unknown) => ipcRenderer.invoke('scanner:run-nmap', options),
    getHistory: () => ipcRenderer.invoke('scanner:get-history'),
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
    getHistory: () => ipcRenderer.invoke('report:get-history'),
    open: (id: string) => ipcRenderer.invoke('report:open', id),
    delete: (id: string, deleteFile: boolean) => ipcRenderer.invoke('report:delete', id, deleteFile),
  },

  // App info
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
})

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      scanner: {
        runNmap: (target: string) => Promise<{ success: boolean; message?: string; data?: unknown }>
        getHistory: () => Promise<unknown[]>
        validateTarget: (target: string) => Promise<{ allowed: boolean; target: string }>
      }
      versions: {
        node: string
        chrome: string
        electron: string
      }
    }
  }
}
