import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { config } from 'dotenv'
import { runNmapScan, getScanHistory, validateTarget, abortScan, deleteScan } from './scanner'
import { GeminiClient } from './llm'
import { exportReport } from './reports'
import { generateHallucinationReport } from './analysis/hallucination-guard'
import { extractMetrics, saveMetricsEntry, loadMetricsHistory, aggregateMetrics } from './analysis/hallucination-metrics'
import { groupScansByTarget, computeAllDeltas } from './analysis/delta-comparison'
import { FEATURE_TOGGLES, getToggleSnapshot } from './analysis/feature-toggles'
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
// Perplexity removed — Pro plan requires credits

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
    frame: false, // Frameless so no OS title bar icon; taskbar icon still set below
    autoHideMenuBar: true,
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

  // Open external links in the system browser instead of Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      import('electron').then(({ shell }) => shell.openExternal(url))
    }
    return { action: 'deny' }
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
// Helpers
// ============================================

/**
 * Find a scan JSON file by matching the `timestamp` field inside each file.
 * The filename uses scan-start time but the timestamp field is scan-completion time,
 * so we can't match by filename alone.
 */
async function findScanFileByTimestamp(scansDir: string, timestamp: string): Promise<string | null> {
  const fsP = await import('node:fs/promises')
  const files = await fsP.readdir(scansDir)
  const jsonFiles = files.filter(f => f.endsWith('.json'))

  for (const file of jsonFiles) {
    try {
      const content = await fsP.readFile(path.join(scansDir, file), 'utf-8')
      const data = JSON.parse(content)
      if (data.timestamp === timestamp) {
        return file
      }
    } catch {
      // Skip unparseable files
    }
  }
  return null
}

// ============================================
// IPC Handlers - Window controls
// ============================================

ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.handle('window:close', () => mainWindow?.close())
ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false)

// ============================================
// IPC Handlers - Scanner integration
// ============================================

// Run Nmap scan
ipcMain.handle('scanner:run-nmap', async (event, options: { target: string }) => {
  const { target } = options
  console.log(`[IPC] Received scan request for: ${target}`)

  // Validate the target (always allowed, disclaimer handled by frontend)
  const validation = await validateTarget(target)
  console.log(`[IPC] Target validated (disclaimer required: ${validation.requiresDisclaimer}), starting progressive scan...`)

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

// Get scan history grouped by target URL
ipcMain.handle('scanner:get-grouped-history', async () => {
  const history = await getScanHistory()
  return groupScansByTarget(history)
})

// Compute all sequential deltas for a given target
ipcMain.handle('scanner:get-deltas', async (_event, target: string) => {
  const history = await getScanHistory()
  const targetScans = history.filter(s => s.target === target)
  if (targetScans.length < 2) return { target, deltas: [] }
  return computeAllDeltas(targetScans)
})

// Save updated scan data (e.g. after LLM analysis enrichment)
ipcMain.handle('scanner:save-scan', async (_event, scanData: any) => {
  if (!scanData?.timestamp) {
    console.error('[IPC] save-scan: missing timestamp')
    return { success: false, error: 'Missing scan timestamp' }
  }
  try {
    const SCANS_DIR = path.join(process.cwd(), 'data', 'scans')
    const fs = await import('node:fs/promises')
    const matchedFile = await findScanFileByTimestamp(SCANS_DIR, scanData.timestamp)
    if (!matchedFile) {
      // No existing file found — create new one
      const safeName = `scan-${scanData.timestamp.replace(/[:.]/g, '-').slice(0, 23)}Z.json`
      await fs.writeFile(path.join(SCANS_DIR, safeName), JSON.stringify(scanData, null, 2))
      console.log(`[IPC] save-scan: created new file ${safeName}`)
      return { success: true }
    }
    await fs.writeFile(path.join(SCANS_DIR, matchedFile), JSON.stringify(scanData, null, 2))
    console.log(`[IPC] save-scan: updated ${matchedFile}`)
    return { success: true }
  } catch (error) {
    console.error('[IPC] save-scan error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// ============================================
// IPC Handlers - LLM Analysis
// ============================================

// Analyze vulnerabilities with Gemini
ipcMain.handle('llm:analyze-vulnerabilities', async (_event, request: LLMAnalysisRequest) => {
  console.log(`[IPC] Received LLM analysis request for ${request.vulnerabilities.length} vulnerabilities`)

  // Ablation: when AI analysis is disabled, skip Gemini call entirely
  if (!FEATURE_TOGGLES.aiAnalysis) {
    console.log('[IPC] AI analysis disabled via feature toggle — returning empty result')
    return {
      success: true,
      analyses: [],
      error: undefined,
      featureToggles: getToggleSnapshot(),
    }
  }

  try {
    // Get API keys from environment
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment variables')
    }
    const fallbackApiKey = process.env.GEMINI_API_KEY2 || undefined
    if (fallbackApiKey) {
      console.log('[IPC] Gemini: 2 API keys available')
    }

    const client = new GeminiClient({ apiKey, fallbackApiKey })
    const result = await client.analyzeVulnerabilities(request)

    // Run hallucination guard: cross-validate AI output against scan data
    if (result.success && result.analyses.length > 0) {
      if (!FEATURE_TOGGLES.hallucinationGuard) {
        // Ablation: skip validation, return neutral report
        console.log('[IPC] Hallucination guard disabled via feature toggle — returning neutral report')
        result.hallucinationReport = {
          totalAnalysed: result.analyses.length,
          lowRisk: 0,
          mediumRisk: 0,
          highRisk: 0,
          flags: [],
          overallTrustScore: 100,
        }
      } else {
        console.log(`[IPC] LLM analysis succeeded with ${result.analyses.length} analyses — running hallucination guard...`)
        const vulns = request.vulnerabilities.map(v => ({
          id: v.id,
          cve: v.cve,
          title: v.title,
          description: v.description,
          severity: v.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
          port: v.port,
          service: v.service,
          output: v.output
        }))
        const hallucinationReport = generateHallucinationReport(vulns, result.analyses)
        result.hallucinationReport = hallucinationReport
        console.log(`[IPC] Hallucination guard: trust=${hallucinationReport.overallTrustScore}/100, high-risk=${hallucinationReport.highRisk}, medium-risk=${hallucinationReport.mediumRisk}, low-risk=${hallucinationReport.lowRisk}`)

        // Persist hallucination metrics for empirical analysis
        console.log('[IPC] Saving hallucination metrics...')
        const metricsEntry = extractMetrics(hallucinationReport, request.scanTimestamp, request.target)
        await saveMetricsEntry(metricsEntry)
        console.log('[IPC] Hallucination metrics saved successfully')
      }

      // Also persist LLM results directly into the scan JSON file
      // so the data survives page reloads without needing a frontend roundtrip
      try {
        const SCANS_DIR = path.join(process.cwd(), 'data', 'scans')
        const fsP = await import('node:fs/promises')
        const matchedFile = await findScanFileByTimestamp(SCANS_DIR, request.scanTimestamp)
        if (matchedFile) {
          const filePath = path.join(SCANS_DIR, matchedFile)
          const content = await fsP.readFile(filePath, 'utf-8')
          const scanJson = JSON.parse(content)
          scanJson.llmAnalysis = result
          await fsP.writeFile(filePath, JSON.stringify(scanJson, null, 2))
          console.log(`[IPC] LLM results persisted to ${matchedFile}`)
        } else {
          console.warn(`[IPC] Could not find scan file for timestamp: ${request.scanTimestamp}`)
        }
      } catch (persistErr) {
        console.error('[IPC] Failed to persist LLM results to scan file:', persistErr)
      }
    }

    console.log(`[IPC] LLM analysis complete: ${result.success ? 'success' : 'failed'}, analyses: ${result.analyses?.length ?? 0}`)
    if (!result.success) {
      console.warn(`[IPC] LLM analysis was not successful: ${result.error || 'no error message'}`)
    }
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

// Export pentest report
ipcMain.handle('report:export-pentest', async (_event, scan: any) => {
  console.log(`[IPC] Received pentest report export request for: ${scan.target}`)

  try {
    const { exportPentestReport } = await import('./reports')
    const result = await exportPentestReport(scan)
    console.log(`[IPC] Pentest report export ${result.success ? 'succeeded' : 'failed'}: ${result.filePath || result.error}`)
    return result
  } catch (error) {
    console.error('[IPC] Pentest report export error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})

// Generate pentest report (auto-save to reports folder)
ipcMain.handle('report:generate-pentest', async (_event, scan: any) => {
  console.log(`[IPC] Received pentest report generation request for: ${scan.target}`)

  try {
    const { generatePentestReport } = await import('./reports')
    const result = await generatePentestReport(scan)
    console.log(`[IPC] Pentest report generation ${result.success ? 'succeeded' : 'failed'}: ${result.filePath || result.error}`)
    return result
  } catch (error) {
    console.error('[IPC] Pentest report generation error:', error)
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

// Open a report file by path
ipcMain.handle('report:open-file', async (_event, filePath: string) => {
  const { shell } = await import('electron')
  const result = await shell.openPath(filePath)
  // openPath returns empty string on success, or error message on failure
  return result === ''
})

// Read a PDF file as base64 for in-app preview
ipcMain.handle('report:read-pdf', async (_event, filePath: string) => {
  try {
    const fsModule = await import('node:fs/promises')
    const data = await fsModule.readFile(filePath)
    return { success: true, data: data.toString('base64') }
  } catch (error) {
    console.error('[IPC] Failed to read PDF:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Generate delta comparison report (auto-save)
ipcMain.handle('report:generate-delta', async (_event, olderTimestamp: string, newerTimestamp: string) => {
  console.log(`[IPC] Delta report: ${olderTimestamp} -> ${newerTimestamp}`)
  try {
    const history = await getScanHistory()
    const older = history.find(s => s.timestamp === olderTimestamp)
    const newer = history.find(s => s.timestamp === newerTimestamp)
    if (!older || !newer) return { success: false, error: 'Scan data not found' }

    const { computeAllDeltas: _cad, compareScanPair } = await import('./analysis/delta-comparison')
    const delta = compareScanPair(older, newer)
    if (!delta.hasChanges) return { success: false, noChanges: true, error: 'No changes between these scans' }

    const { generateDeltaReport } = await import('./reports/delta-report-generator')
    return generateDeltaReport(delta, older, newer)
  } catch (error) {
    console.error('[IPC] Delta report generation error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Export delta comparison report via save dialog
ipcMain.handle('report:export-delta', async (_event, olderTimestamp: string, newerTimestamp: string) => {
  console.log(`[IPC] Delta report export: ${olderTimestamp} -> ${newerTimestamp}`)
  try {
    const history = await getScanHistory()
    const older = history.find(s => s.timestamp === olderTimestamp)
    const newer = history.find(s => s.timestamp === newerTimestamp)
    if (!older || !newer) return { success: false, error: 'Scan data not found' }

    const { compareScanPair } = await import('./analysis/delta-comparison')
    const delta = compareScanPair(older, newer)
    if (!delta.hasChanges) return { success: false, noChanges: true, error: 'No changes between these scans' }

    const { exportDeltaReport } = await import('./reports/delta-report-generator')
    return exportDeltaReport(delta, older, newer)
  } catch (error) {
    console.error('[IPC] Delta report export error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// ============================================
// IPC Handlers - Hallucination Metrics
// ============================================

// Get full metrics history
ipcMain.handle('hallucination:get-metrics-history', async () => {
  return loadMetricsHistory()
})

// Get aggregated metrics
ipcMain.handle('hallucination:get-metrics-aggregate', async () => {
  const entries = await loadMetricsHistory()
  return aggregateMetrics(entries)
})
