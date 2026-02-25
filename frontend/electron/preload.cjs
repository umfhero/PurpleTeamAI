const { contextBridge, ipcRenderer } = require('electron')

// Expose secure APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Scanner APIs
  scanner: {
    runNmap: (options) => ipcRenderer.invoke('scanner:run-nmap', options),
    getHistory: () => ipcRenderer.invoke('scanner:get-history'),
    getGroupedHistory: () => ipcRenderer.invoke('scanner:get-grouped-history'),
    getDeltas: (target) => ipcRenderer.invoke('scanner:get-deltas', target),
    validateTarget: (target) => ipcRenderer.invoke('scanner:validate-target', target),
    abort: () => ipcRenderer.invoke('scanner:abort'),
    deleteScan: (timestamp) => ipcRenderer.invoke('scanner:delete-scan', timestamp),
    onProgress: (callback) => {
      const listener = (_event, line) => callback(line)
      ipcRenderer.on('scanner:progress', listener)
      // Return cleanup function
      return () => ipcRenderer.removeListener('scanner:progress', listener)
    },
    onPhaseResult: (callback) => {
      const listener = (_event, data) => callback(data)
      ipcRenderer.on('scanner:phase-result', listener)
      return () => ipcRenderer.removeListener('scanner:phase-result', listener)
    },
  },

  // LLM APIs
  llm: {
    analyzeVulnerabilities: (request) => ipcRenderer.invoke('llm:analyze-vulnerabilities', request),
  },

  // Report APIs
  report: {
    export: (options) => ipcRenderer.invoke('report:export', options),
    exportPentest: (scan) => ipcRenderer.invoke('report:export-pentest', scan),
    generatePentest: (scan) => ipcRenderer.invoke('report:generate-pentest', scan),
    generateDelta: (olderTs, newerTs) => ipcRenderer.invoke('report:generate-delta', olderTs, newerTs),
    exportDelta: (olderTs, newerTs) => ipcRenderer.invoke('report:export-delta', olderTs, newerTs),
    getHistory: () => ipcRenderer.invoke('report:get-history'),
    open: (id) => ipcRenderer.invoke('report:open', id),
    openFile: (filePath) => ipcRenderer.invoke('report:open-file', filePath),
    readPdf: (filePath) => ipcRenderer.invoke('report:read-pdf', filePath),
    delete: (id, deleteFile) => ipcRenderer.invoke('report:delete', id, deleteFile),
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
