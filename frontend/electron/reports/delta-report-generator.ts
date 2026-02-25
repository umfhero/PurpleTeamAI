// Delta Comparison Report Generator
// Generates a "Summary Report" PDF comparing two sequential scans of the same target.

import { dialog, shell, app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NmapScanData, VulnerabilityResult } from '../scanner/types'
import type { ScanDelta } from './delta-types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getDataDir(): string {
  const isDev = !app.isPackaged
  if (isDev) return path.join(__dirname, '../../data')
  return path.join(app.getPath('userData'), 'data')
}

function getReportsDir(): string {
  return path.join(getDataDir(), 'reports')
}

function sanitizeTarget(target: string): string {
  return target.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/^\.+/, '')
}

function formatDate(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function generateDeltaFilename(target: string, olderTs: string, newerTs: string): string {
  const t = sanitizeTarget(target)
  const older = olderTs.replace(/[:.]/g, '-').replace('Z', '')
  const newer = newerTs.replace(/[:.]/g, '-').replace('Z', '')
  return `delta_${t}_${older}_to_${newer}.pdf`
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

const SEVERITY_PALETTE: Record<string, { accent: string; muted: string; label: string }> = {
  critical: { accent: '#DC143C', muted: '#2a0010', label: 'CRITICAL' },
  high:     { accent: '#FF4500', muted: '#2a1000', label: 'HIGH' },
  medium:   { accent: '#FFA500', muted: '#2a1800', label: 'MEDIUM' },
  low:      { accent: '#32CD32', muted: '#002a00', label: 'LOW' },
  info:     { accent: '#4682B4', muted: '#001628', label: 'INFO' },
}

const OWASP_NAMES: Record<string, string> = {
  A01: 'Broken Access Control',       A02: 'Cryptographic Failures',
  A03: 'Injection',                   A04: 'Insecure Design',
  A05: 'Security Misconfiguration',   A06: 'Vulnerable and Outdated Components',
  A07: 'Auth Failures',               A08: 'Data Integrity Failures',
  A09: 'Logging Failures',            A10: 'SSRF',
}

function scoreColor(change: number): string {
  if (change > 5) return '#32CD32'
  if (change < -5) return '#DC143C'
  return '#888888'
}

function scoreArrow(change: number): string {
  if (change > 0) return '&#9650;'    // ▲
  if (change < 0) return '&#9660;'    // ▼
  return '&#9654;'                    // ►
}

// ---------------------------------------------------------------------------
// Vulnerability card HTML
// ---------------------------------------------------------------------------

function vulnCard(vuln: VulnerabilityResult, accent: string, muted: string): string {
  const p = SEVERITY_PALETTE[vuln.severity] ?? SEVERITY_PALETTE.info
  return `
    <div style="border:1px solid ${accent}; background:${muted}; margin-bottom:10px; padding:14px 16px;">
      <div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:6px;">
        <span style="background:${p.accent}; color:#fff; font-size:9px; font-family:monospace;
                     letter-spacing:1px; padding:2px 6px; flex-shrink:0; margin-top:2px;">
          ${p.label}
        </span>
        <span style="font-family:monospace; font-size:12px; color:#e0e0e0; font-weight:600;">
          ${escapeHtml(vuln.title)}
        </span>
      </div>
      ${vuln.cve ? `<div style="font-family:monospace; font-size:10px; color:#888; margin-bottom:4px;">${escapeHtml(vuln.cve)}</div>` : ''}
      <div style="font-family:monospace; font-size:11px; color:#b0b0b0; line-height:1.5; margin-bottom:4px;">
        ${escapeHtml(vuln.description)}
      </div>
      ${vuln.port ? `<div style="font-family:monospace; font-size:10px; color:#666;">Port: ${vuln.port}${vuln.service ? ` / ${escapeHtml(vuln.service)}` : ''}</div>` : ''}
    </div>`
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function sectionHeader(title: string, accent: string, count: number, subtitle: string): string {
  return `
    <div style="border-left:4px solid ${accent}; padding:10px 16px; margin:28px 0 14px;
                background:${accent}11; display:flex; align-items:center; gap:14px;">
      <span style="font-family:monospace; font-size:18px; color:${accent}; font-weight:700;">${count}</span>
      <div>
        <div style="font-family:monospace; font-size:13px; color:${accent}; letter-spacing:2px; font-weight:700; text-transform:uppercase;">${title}</div>
        <div style="font-family:monospace; font-size:10px; color:#888; margin-top:2px;">${subtitle}</div>
      </div>
    </div>`
}

// ---------------------------------------------------------------------------
// Full HTML document
// ---------------------------------------------------------------------------

export function generateDeltaReportHTML(
  delta: ScanDelta,
  olderScan: NmapScanData,
  newerScan: NmapScanData
): string {
  const olderDate = formatDate(delta.olderTimestamp)
  const newerDate = formatDate(delta.newerTimestamp)
  const target = olderScan.target
  const scoreColor_ = scoreColor(delta.scoreChange)
  const arrow = scoreArrow(delta.scoreChange)

  // Summary counts by severity for new and resolved
  const countBySeverity = (vulns: VulnerabilityResult[]) =>
    ['critical', 'high', 'medium', 'low', 'info'].map(s => ({
      s, n: vulns.filter(v => v.severity === s).length
    })).filter(x => x.n > 0)

  const resolvedBySev = countBySeverity(delta.resolved)
  const newBySev = countBySeverity(delta.newVulns)

  const resolvedCards = delta.resolved
    .sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))
    .map(v => vulnCard(v, '#32CD32', '#002a00'))
    .join('')

  const newCards = delta.newVulns
    .sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))
    .map(v => vulnCard(v, '#DC143C', '#2a0010'))
    .join('')

  const persistingCards = delta.persisting
    .sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))
    .map(v => vulnCard(v, '#FFA500', '#2a1800'))
    .join('')

  // OWASP table rows
  const owaspRows = delta.owaspDelta.map(e => {
    const change = e.change
    const color = change < 0 ? '#32CD32' : change > 0 ? '#DC143C' : '#888888'
    const changeStr = change > 0 ? `+${change}` : String(change)
    const id = e.category.toString()
    return `
      <tr>
        <td style="font-family:monospace;font-size:10px;color:#888;padding:5px 8px;border-bottom:1px solid #1e1e1e;">${id}</td>
        <td style="font-family:monospace;font-size:10px;color:#ccc;padding:5px 8px;border-bottom:1px solid #1e1e1e;">${OWASP_NAMES[id] ?? id}</td>
        <td style="font-family:monospace;font-size:10px;color:#888;padding:5px 8px;border-bottom:1px solid #1e1e1e;text-align:center;">${e.oldCount}</td>
        <td style="font-family:monospace;font-size:10px;color:#888;padding:5px 8px;border-bottom:1px solid #1e1e1e;text-align:center;">${e.newCount}</td>
        <td style="font-family:monospace;font-size:10px;color:${color};padding:5px 8px;border-bottom:1px solid #1e1e1e;text-align:center;font-weight:700;">${changeStr}</td>
      </tr>`
  }).join('')

  // Severity badge pills for summary bar
  const severityBadges = (items: { s: string; n: number }[]) =>
    items.map(({ s, n }) => {
      const p = SEVERITY_PALETTE[s] ?? SEVERITY_PALETTE.info
      return `<span style="background:${p.accent};color:#fff;font-family:monospace;font-size:9px;
                     letter-spacing:1px;padding:2px 8px;margin-right:4px;">${n} ${p.label}</span>`
    }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scan Comparison — ${escapeHtml(target)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0a0a;
      color: #e0e0e0;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.6;
      padding: 48px 56px;
      max-width: 900px;
      margin: 0 auto;
    }
    @page { size: A4; margin: 20mm; }
    @media print { body { padding: 0; } }
    hr { border: none; border-top: 1px solid #1e1e1e; margin: 24px 0; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>

  <!-- ============ COVER ============ -->
  <div style="border:1px solid #222; padding:36px 40px; margin-bottom:40px;">
    <div style="font-size:9px; color:#555; letter-spacing:3px; text-transform:uppercase; margin-bottom:8px;">
      PURPLETEAM SUITE — SCAN COMPARISON REPORT
    </div>
    <div style="font-size:22px; color:#e0e0e0; font-weight:700; margin-bottom:4px;">
      ${escapeHtml(target)}
    </div>
    <div style="font-size:10px; color:#555; margin-bottom:28px;">
      Generated ${formatDate(new Date().toISOString())}
    </div>

    <div style="display:flex; gap:24px; margin-bottom:24px;">
      <div style="flex:1; border:1px solid #1e1e1e; padding:14px 18px;">
        <div style="font-size:9px; color:#555; letter-spacing:2px; margin-bottom:4px;">BASELINE SCAN</div>
        <div style="font-size:11px; color:#888;">${olderDate}</div>
        <div style="font-size:20px; color:#888; font-weight:700; margin-top:6px;">${delta.olderScore.toFixed(1)}</div>
        <div style="font-size:9px; color:#555;">Security Score</div>
      </div>
      <div style="flex:0; display:flex; align-items:center; font-size:18px; color:#444;">&#8594;</div>
      <div style="flex:1; border:1px solid #1e1e1e; padding:14px 18px;">
        <div style="font-size:9px; color:#555; letter-spacing:2px; margin-bottom:4px;">LATEST SCAN</div>
        <div style="font-size:11px; color:#888;">${newerDate}</div>
        <div style="font-size:20px; color:${scoreColor_}; font-weight:700; margin-top:6px;">${delta.newerScore.toFixed(1)}</div>
        <div style="font-size:9px; color:#555;">Security Score</div>
      </div>
      <div style="flex:1; border:1px solid ${scoreColor_}44; padding:14px 18px;">
        <div style="font-size:9px; color:#555; letter-spacing:2px; margin-bottom:4px;">SCORE CHANGE</div>
        <div style="font-size:11px; color:#555; margin-bottom:6px;">&nbsp;</div>
        <div style="font-size:24px; color:${scoreColor_}; font-weight:700;">${arrow} ${delta.scoreChange > 0 ? '+' : ''}${delta.scoreChange.toFixed(1)}</div>
        <div style="font-size:9px; color:#555;">${delta.scoreChange > 0 ? 'Improved' : delta.scoreChange < 0 ? 'Degraded' : 'Unchanged'}</div>
      </div>
    </div>

    <!-- Summary bar -->
    <div style="display:flex; gap:16px;">
      <div style="flex:1; border:1px solid #32CD3244; background:#002a0022; padding:12px 14px; text-align:center;">
        <div style="font-size:20px; color:#32CD32; font-weight:700;">${delta.resolved.length}</div>
        <div style="font-size:9px; color:#32CD32; letter-spacing:1px;">RESOLVED</div>
        ${resolvedBySev.length ? `<div style="margin-top:6px;">${severityBadges(resolvedBySev)}</div>` : ''}
      </div>
      <div style="flex:1; border:1px solid #DC143C44; background:#2a001022; padding:12px 14px; text-align:center;">
        <div style="font-size:20px; color:#DC143C; font-weight:700;">${delta.newVulns.length}</div>
        <div style="font-size:9px; color:#DC143C; letter-spacing:1px;">NEW</div>
        ${newBySev.length ? `<div style="margin-top:6px;">${severityBadges(newBySev)}</div>` : ''}
      </div>
      <div style="flex:1; border:1px solid #FFA50044; background:#2a180022; padding:12px 14px; text-align:center;">
        <div style="font-size:20px; color:#FFA500; font-weight:700;">${delta.persisting.length}</div>
        <div style="font-size:9px; color:#FFA500; letter-spacing:1px;">PERSISTING</div>
      </div>
    </div>
  </div>

  <!-- ============ RESOLVED ============ -->
  ${sectionHeader('Resolved Vulnerabilities', '#32CD32', delta.resolved.length,
    'These findings were present in the baseline scan but no longer detected — remediated or no longer exposed.')}
  ${delta.resolved.length === 0
    ? `<div style="font-family:monospace;font-size:11px;color:#444;padding:10px;">No vulnerabilities were resolved between these two scans.</div>`
    : resolvedCards}

  <hr>

  <!-- ============ NEW ============ -->
  ${sectionHeader('New Vulnerabilities', '#DC143C', delta.newVulns.length,
    'These findings were not present in the baseline scan — newly introduced or newly detected regressions.')}
  ${delta.newVulns.length === 0
    ? `<div style="font-family:monospace;font-size:11px;color:#444;padding:10px;">No new vulnerabilities were introduced between these two scans.</div>`
    : newCards}

  <hr>

  <!-- ============ PERSISTING ============ -->
  ${sectionHeader('Persisting Vulnerabilities', '#FFA500', delta.persisting.length,
    'These findings remain present in both scans and have not been addressed.')}
  ${delta.persisting.length === 0
    ? `<div style="font-family:monospace;font-size:11px;color:#444;padding:10px;">No persisting vulnerabilities.</div>`
    : persistingCards}

  <!-- ============ OWASP DELTA ============ -->
  ${delta.owaspDelta.length > 0 ? `
  <hr>
  <div style="border-left:4px solid #4682B4; padding:10px 16px; margin:28px 0 14px; background:#4682B411;">
    <div style="font-family:monospace; font-size:13px; color:#4682B4; letter-spacing:2px; font-weight:700; text-transform:uppercase;">OWASP Coverage Delta</div>
    <div style="font-family:monospace; font-size:10px; color:#888; margin-top:2px;">Change in vulnerability count per OWASP Top 10 category</div>
  </div>
  <table>
    <thead>
      <tr style="border-bottom:1px solid #333;">
        <th style="font-family:monospace;font-size:9px;color:#555;text-align:left;padding:5px 8px;letter-spacing:1px;">ID</th>
        <th style="font-family:monospace;font-size:9px;color:#555;text-align:left;padding:5px 8px;letter-spacing:1px;">CATEGORY</th>
        <th style="font-family:monospace;font-size:9px;color:#555;text-align:center;padding:5px 8px;letter-spacing:1px;">BEFORE</th>
        <th style="font-family:monospace;font-size:9px;color:#555;text-align:center;padding:5px 8px;letter-spacing:1px;">AFTER</th>
        <th style="font-family:monospace;font-size:9px;color:#555;text-align:center;padding:5px 8px;letter-spacing:1px;">CHANGE</th>
      </tr>
    </thead>
    <tbody>${owaspRows}</tbody>
  </table>` : ''}

  <!-- ============ FOOTER ============ -->
  <div style="margin-top:48px; border-top:1px solid #1e1e1e; padding-top:14px;
              display:flex; justify-content:space-between; font-size:9px; color:#444;">
    <span>PURPLETEAM SUITE — AUTOMATED SECURITY COMPARISON</span>
    <span>CONFIDENTIAL — AUTHORISED USE ONLY</span>
  </div>

</body>
</html>`
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

/**
 * Generate and auto-save a delta comparison report PDF.
 * Returns cached path if the file already exists.
 */
export async function generateDeltaReport(
  delta: ScanDelta,
  olderScan: NmapScanData,
  newerScan: NmapScanData
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const reportsDir = getReportsDir()
    const tempDir = path.join(getDataDir(), 'temp')
    await fs.mkdir(reportsDir, { recursive: true })
    await fs.mkdir(tempDir, { recursive: true })

    const filename = generateDeltaFilename(olderScan.target, delta.olderTimestamp, delta.newerTimestamp)
    const filePath = path.join(reportsDir, filename)

    // Return cached copy if available
    try {
      await fs.access(filePath)
      console.log('[DeltaReport] Using cached report:', filePath)
      return { success: true, filePath }
    } catch { /* not cached */ }

    const htmlContent = generateDeltaReportHTML(delta, olderScan, newerScan)
    const tempHtmlPath = path.join(tempDir, 'temp-delta-report.html')
    await fs.writeFile(tempHtmlPath, htmlContent, 'utf-8')

    const { BrowserWindow } = await import('electron')
    const win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    await win.loadFile(tempHtmlPath)
    await new Promise(resolve => setTimeout(resolve, 1000))

    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      marginsType: 1,
      pageSize: 'A4',
      landscape: false,
    })

    win.close()
    await fs.writeFile(filePath, pdfData)
    await fs.unlink(tempHtmlPath).catch(() => { })

    console.log('[DeltaReport] PDF generated:', filePath)
    return { success: true, filePath }
  } catch (error) {
    console.error('[DeltaReport] Generation failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Generate delta report and show a save dialog for user download.
 */
export async function exportDeltaReport(
  delta: ScanDelta,
  olderScan: NmapScanData,
  newerScan: NmapScanData
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const htmlContent = generateDeltaReportHTML(delta, olderScan, newerScan)
    const tempDir = path.join(getDataDir(), 'temp')
    await fs.mkdir(tempDir, { recursive: true })

    const tempHtmlPath = path.join(tempDir, 'temp-delta-report.html')
    await fs.writeFile(tempHtmlPath, htmlContent, 'utf-8')

    const defaultName = generateDeltaFilename(olderScan.target, delta.olderTimestamp, delta.newerTimestamp)

    const result = await dialog.showSaveDialog({
      title: 'Export Comparison Report',
      defaultPath: defaultName,
      filters: [
        { name: 'PDF Document', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })

    if (result.canceled || !result.filePath) {
      await fs.unlink(tempHtmlPath).catch(() => { })
      return { success: false, error: 'Export cancelled' }
    }

    const { BrowserWindow } = await import('electron')
    const win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    await win.loadFile(tempHtmlPath)
    await new Promise(resolve => setTimeout(resolve, 1000))

    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      marginsType: 1,
      pageSize: 'A4',
      landscape: false,
    })

    win.close()
    await fs.writeFile(result.filePath, pdfData)
    await fs.unlink(tempHtmlPath).catch(() => { })
    await shell.openPath(result.filePath)

    console.log('[DeltaReport] PDF exported:', result.filePath)
    return { success: true, filePath: result.filePath }
  } catch (error) {
    console.error('[DeltaReport] Export failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function severityOrder(s: string): number {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[s] ?? 5
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
