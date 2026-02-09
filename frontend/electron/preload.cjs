const { contextBridge, ipcRenderer } = require('electron')

// Expose secure APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Scanner APIs
  scanner: {
    runNmap: (options) => ipcRenderer.invoke('scanner:run-nmap', options),
    getHistory: () => ipcRenderer.invoke('scanner:get-history'),
    validateTarget: (target) => ipcRenderer.invoke('scanner:validate-target', target),
    abort: () => ipcRenderer.invoke('scanner:abort'),
    onProgress: (callback) => {
      const listener = (_event, line) => callback(line)
      ipcRenderer.on('scanner:progress', listener)
      // Return cleanup function
      return () => ipcRenderer.removeListener('scanner:progress', listener)
    },
  },

  // LLM APIs
  llm: {
    analyzeVulnerabilities: (request) => ipcRenderer.invoke('llm:analyze-vulnerabilities', request),
  },

  // Report APIs
  report: {
    export: (options) => ipcRenderer.invoke('report:export', options),
    getHistory: () => ipcRenderer.invoke('report:get-history'),
    open: (id) => ipcRenderer.invoke('report:open', id),
    delete: (id, deleteFile) => ipcRenderer.invoke('report:delete', id, deleteFile),
  },

  // App info
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
})
