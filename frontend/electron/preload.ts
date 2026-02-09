import { contextBridge, ipcRenderer } from 'electron'

// Expose secure APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Scanner APIs
  scanner: {
    runNmap: (target: string) => ipcRenderer.invoke('scanner:run-nmap', target),
    getHistory: () => ipcRenderer.invoke('scanner:get-history'),
    validateTarget: (target: string) => ipcRenderer.invoke('scanner:validate-target', target),
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
