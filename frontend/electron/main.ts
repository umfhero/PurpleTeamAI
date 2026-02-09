import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Paths
const RENDERER_DIST = path.join(__dirname, '../dist')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'PurpleTeamAI',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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
// IPC Handlers - Scanner integration goes here
// ============================================

// Placeholder: Run Nmap scan
ipcMain.handle('scanner:run-nmap', async (_event, target: string) => {
  console.log(`[IPC] Received scan request for: ${target}`)
  // TODO: Implement Nmap orchestration in Week 2
  return { success: false, message: 'Scanner not yet implemented' }
})

// Placeholder: Get scan history
ipcMain.handle('scanner:get-history', async () => {
  // TODO: Load scan history from data/scans/
  return []
})

// Placeholder: Validate target against allowlist
ipcMain.handle('scanner:validate-target', async (_event, target: string) => {
  // TODO: Check against allowed-targets.json
  const allowedPatterns = ['testphp.vulnweb.com', 'localhost', '127.0.0.1']
  const isAllowed = allowedPatterns.some(pattern => target.includes(pattern))
  return { allowed: isAllowed, target }
})
