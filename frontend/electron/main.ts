import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { config } from 'dotenv'
import { runNmapScan, getScanHistory, validateTarget, abortScan, deleteScan } from './scanner'
import { GeminiClient } from './llm'
import { exportReport } from './reports'
import type { LLMAnalysisRequest } from './llm'
import type { ReportOptions } from './reports'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment variables from .env file in the project root
// In development, .env is at project root (two levels up from dist-electron)
// In production, it should be bundled or use a different approach
const envPath = app.isPackaged
  ? path.join(process.resourcesPath, '.env')
  : path.join(__dirname, '../../.env')

config({ path: envPath })

console.log('[Main] Environment loaded from:', envPath)
console.log('[Main] GEMINI_API_KEY present:', !!process.env.GEMINI_API_KEY)

// Paths
const RENDERER_DIST = path.join(__dirname, '../dist')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

let mainWindow: BrowserWindow | null = null

function createWindow() {
  // Icon path for both dev and production
  const iconPath = VITE_DEV_SERVER_URL
    ? path.join(__dirname, '../public/icon.png')
    : path.join(process.resourcesPath, 'icon.png')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'PurpleTeam Suite',
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true, // Hide menu bar (File, Edit, View, etc.)
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for preload to work with IPC
    },
  })

  // Remove default menu in production
  if (!VITE_DEV_SERVER_URL) {
    mainWindow.setMenu(null)
  }

  // Load the app
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    // Open DevTools in detached (popout) mode
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // Register F12 to toggle DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      if (mainWindow?.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      } else {
        mainWindow?.webContents.openDevTools({ mode: 'detach' })
      }
      event.preventDefault()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// App lifecycle
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ============================================
// IPC Handlers - Scanner integration
// ============================================

// Run Nmap scan
ipcMain.handle('scanner:run-nmap', async (event, options: { target: string }) => {
  const { target } = options
  console.log(`[IPC] Received scan request for: ${target}`)

  // First validate the target
  const validation = await validateTarget(target)
  if (!validation.allowed) {
    console.log(`[IPC] Target validation failed: ${target}`)
    return { success: false, message: `Target "${target}" is not in the allowlist` }
  }

  console.log(`[IPC] Target validated, starting progressive scan...`)

  // Run the scan with progress + phase callbacks
  const result = await runNmapScan(
    { target },
    (progressLine: string) => {
      // Send progress to renderer
      event.sender.send('scanner:progress', progressLine)
    },
    (phaseData) => {
      // Send Phase 1 results to renderer immediately
      event.sender.send('scanner:phase-result', phaseData)
    },
  )

  console.log(`[IPC] Scan completed: ${result.success ? 'success' : 'failed'}`)
  return result
})

// Get scan history
ipcMain.handle('scanner:get-history', async () => {
  const history = await getScanHistory()
  return history
})

// Validate target against allowlist
ipcMain.handle('scanner:validate-target', async (_event, target: string) => {
  const result = await validateTarget(target)
  return result
})

// Abort current scan
ipcMain.handle('scanner:abort', () => {
  console.log('[IPC] Received scan abort request')
  return abortScan()
})

// Delete a scan
ipcMain.handle('scanner:delete-scan', async (_event, timestamp: string) => {
  console.log(`[IPC] Received delete scan request for timestamp: ${timestamp}`)
  return deleteScan(timestamp)
})

// ============================================
// IPC Handlers - LLM Analysis
// ============================================

// Analyze vulnerabilities with Gemini
ipcMain.handle('llm:analyze-vulnerabilities', async (_event, request: LLMAnalysisRequest) => {
  console.log(`[IPC] Received LLM analysis request for ${request.vulnerabilities.length} vulnerabilities`)

  try {
    // Get API key from environment
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment variables')
    }

    const client = new GeminiClient({ apiKey })
    const result = await client.analyzeVulnerabilities(request)

    console.log(`[IPC] LLM analysis complete: ${result.success ? 'success' : 'failed'}`)
    return result
  } catch (error) {
    console.error('[IPC] LLM analysis error:', error)
    return {
      success: false,
      analyses: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})

// ============================================
// IPC Handlers - Report Generation
// ============================================

// Export report
ipcMain.handle('report:export', async (_event, options: ReportOptions) => {
  console.log(`[IPC] Received report export request for: ${options.scan.target}`)

  try {
    const result = await exportReport(options)
    console.log(`[IPC] Report export ${result.success ? 'succeeded' : 'failed'}: ${result.filePath || result.error}`)
    return result
  } catch (error) {
    console.error('[IPC] Report export error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})

// Get report history
ipcMain.handle('report:get-history', async () => {
  const { getReportHistory } = await import('./reports')
  return getReportHistory()
})

// Open a report file
ipcMain.handle('report:open', async (_event, id: string) => {
  const { openReport } = await import('./reports')
  return openReport(id)
})

// Delete a report
ipcMain.handle('report:delete', async (_event, id: string, deleteFile: boolean) => {
  const { deleteReport } = await import('./reports')
  return deleteReport(id, deleteFile)
})
