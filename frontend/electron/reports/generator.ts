import { dialog, shell, app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { NmapScanData, VulnerabilityResult } from '../scanner/types'
import type { ReportOptions, ReportResult, ReportMetadata } from './types'

// Get data directory for storing report metadata
function getDataDir(): string {
  // In development, use frontend/data. In production, use userData
  const isDev = !app.isPackaged
  if (isDev) {
    return path.join(__dirname, '../../data')
  }
  return path.join(app.getPath('userData'), 'data')
}

function getReportsDir(): string {
  return path.join(getDataDir(), 'reports')
}

function getMetadataPath(): string {
  return path.join(getReportsDir(), 'metadata.json')
}

// OWASP Top 10 2021 category names
const OWASP_NAMES: Record<string, string> = {
  A01: 'Broken Access Control',
  A02: 'Cryptographic Failures',
  A03: 'Injection',
  A04: 'Insecure Design',
  A05: 'Security Misconfiguration',
  A06: 'Vulnerable Components',
  A07: 'Authentication Failures',
  A08: 'Integrity Failures',
  A09: 'Logging Failures',
  A10: 'SSRF',
}

// Severity colors for the report
const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: '#ef4444', text: '#ffffff' },
  high: { bg: '#f97316', text: '#000000' },
  medium: { bg: '#eab308', text: '#000000' },
  low: { bg: '#22c55e', text: '#000000' },
  info: { bg: '#6b7280', text: '#ffffff' },
}

// Get grade color
function getGradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return '#22c55e'
  if (grade === 'B') return '#eab308'
  if (grade === 'C') return '#f97316'
  return '#ef4444'
}

// Generate HTML report
export function generateHtmlReport(scan: NmapScanData): string {
  const timestamp = new Date(scan.timestamp).toLocaleString()
  const score = scan.securityScore
  const owasp = scan.owaspCoverage
  
  // Sort vulnerabilities by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
  const sortedVulns = [...scan.vulnerabilities].sort(
    (a, b) => (severityOrder[a.severity] || 5) - (severityOrder[b.severity] || 5)
  )

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Report - ${escapeHtml(scan.target)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
      background: #0a0a0a;
      color: #e5e5e5;
      line-height: 1.5;
      padding: 40px;
    }
    
    .container {
      max-width: 1100px;
      margin: 0 auto;
    }
    
    .header {
      border: 1px solid #404040;
      padding: 24px;
      margin-bottom: 24px;
    }
    
    .header h1 {
      font-size: 24px;
      margin-bottom: 8px;
      color: #c4b5fd;
    }
    
    .header .meta {
      font-size: 12px;
      color: #a0a0a0;
    }
    
    .section {
      border: 1px solid #404040;
      margin-bottom: 24px;
    }
    
    .section-header {
      padding: 12px 16px;
      border-bottom: 1px solid #404040;
      background: #1a1a1a;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #a0a0a0;
    }
    
    .section-body {
      padding: 16px;
    }
    
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    
    .score-display {
      text-align: center;
      padding: 24px;
    }
    
    .score-value {
      font-size: 64px;
      font-weight: bold;
    }
    
    .score-grade {
      font-size: 24px;
      margin-top: 8px;
    }
    
    .score-breakdown {
      margin-top: 16px;
      font-size: 11px;
      color: #a0a0a0;
    }
    
    .breakdown-item {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #2a2a2a;
    }
    
    .owasp-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
    }
    
    .owasp-cell {
      padding: 12px 8px;
      text-align: center;
      font-size: 10px;
      border: 1px solid #404040;
    }
    
    .owasp-cell.found {
      background: rgba(196, 181, 253, 0.2);
      border-color: #c4b5fd;
    }
    
    .owasp-cell .code {
      font-weight: bold;
      font-size: 12px;
    }
    
    .vuln-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    
    .vuln-table th {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #404040;
      background: #1a1a1a;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #a0a0a0;
    }
    
    .vuln-table td {
      padding: 12px;
      border-bottom: 1px solid #2a2a2a;
      vertical-align: top;
    }
    
    .severity-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: bold;
    }
    
    .remediation {
      margin-top: 16px;
      padding: 12px;
      background: #1a1a1a;
      border-left: 3px solid #c4b5fd;
    }
    
    .remediation h4 {
      font-size: 11px;
      text-transform: uppercase;
      color: #c4b5fd;
      margin-bottom: 8px;
    }
    
    .remediation ul {
      margin-left: 16px;
      font-size: 11px;
    }
    
    .remediation li {
      margin-bottom: 4px;
    }
    
    .port-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .port-item {
      padding: 4px 8px;
      font-size: 11px;
      border: 1px solid #404040;
    }
    
    .port-item.open {
      border-color: #22c55e;
      color: #22c55e;
    }
    
    .summary-stat {
      text-align: center;
      padding: 16px;
      border: 1px solid #2a2a2a;
    }
    
    .summary-stat .value {
      font-size: 32px;
      font-weight: bold;
    }
    
    .summary-stat .label {
      font-size: 10px;
      text-transform: uppercase;
      color: #a0a0a0;
      margin-top: 4px;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #404040;
      font-size: 10px;
      color: #606060;
      text-align: center;
    }
    
    @media print {
      body {
        background: white;
        color: black;
        padding: 20px;
      }
      .section {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>Security Assessment Report</h1>
      <div class="meta">
        <div><strong>Target:</strong> ${escapeHtml(scan.target)}</div>
        <div><strong>Scan Type:</strong> ${escapeHtml(scan.scanType)}</div>
        <div><strong>Timestamp:</strong> ${timestamp}</div>
        <div><strong>Generated by:</strong> PurpleTeam Suite</div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="section">
      <div class="section-header">Executive Summary</div>
      <div class="section-body">
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px;">
          ${generateSummaryStats(scan)}
        </div>
      </div>
    </div>

    <!-- Score and OWASP Grid -->
    <div class="grid-2">
      <!-- Security Score -->
      <div class="section">
        <div class="section-header">Security Score</div>
        <div class="section-body score-display">
          ${score ? `
            <div class="score-value" style="color: ${getGradeColor(score.grade)}">${score.overall}%</div>
            <div class="score-grade" style="color: ${getGradeColor(score.grade)}">Grade: ${score.grade}</div>
            <div class="score-breakdown">
              <div class="breakdown-item"><span>Severity Impact</span><span>${score.breakdown.severityImpact.toFixed(1)}</span></div>
              <div class="breakdown-item"><span>OWASP Coverage</span><span>${score.breakdown.owaspCoverage.toFixed(1)}</span></div>
              <div class="breakdown-item"><span>Remediation Potential</span><span>${score.breakdown.remediationPotential.toFixed(1)}</span></div>
            </div>
          ` : '<div style="color: #606060">No score calculated</div>'}
        </div>
      </div>

      <!-- OWASP Coverage -->
      <div class="section">
        <div class="section-header">OWASP Top 10 Coverage</div>
        <div class="section-body">
          <div class="owasp-grid">
            ${generateOwaspGrid(owasp?.categories || [])}
          </div>
          <div style="margin-top: 16px; font-size: 11px; color: #a0a0a0;">
            Coverage: ${owasp?.categories.length || 0}/10 categories (${owasp?.percentage || 0}%)
          </div>
        </div>
      </div>
    </div>

    <!-- Open Ports -->
    <div class="section">
      <div class="section-header">Open Ports (${scan.ports.filter(p => p.state === 'open').length})</div>
      <div class="section-body">
        <div class="port-list">
          ${scan.ports
            .filter(p => p.state === 'open')
            .map(p => `
              <div class="port-item open">
                <strong>${p.port}/${p.protocol}</strong> - ${escapeHtml(p.service || 'unknown')}
                ${p.version ? `<br><span style="color: #a0a0a0">${escapeHtml(p.version)}</span>` : ''}
              </div>
            `).join('')}
        </div>
      </div>
    </div>

    <!-- Vulnerability Table -->
    <div class="section">
      <div class="section-header">Vulnerabilities (${scan.vulnerabilities.length})</div>
      <div class="section-body" style="padding: 0;">
        <table class="vuln-table">
          <thead>
            <tr>
              <th style="width: 80px;">Severity</th>
              <th style="width: 100px;">CVE</th>
              <th>Vulnerability</th>
              <th style="width: 80px;">Port</th>
              <th style="width: 120px;">Service</th>
            </tr>
          </thead>
          <tbody>
            ${sortedVulns.map(v => generateVulnRow(v, scan.llmAnalysis?.analyses || [])).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Prioritized Remediation -->
    ${scan.llmAnalysis?.analyses.length ? `
    <div class="section">
      <div class="section-header">Prioritized Remediation Steps</div>
      <div class="section-body">
        ${generateRemediationSection(scan)}
      </div>
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      Generated by PurpleTeam Suite on ${new Date().toLocaleString()}<br>
      This report is for authorized security assessment purposes only.
    </div>
  </div>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function generateSummaryStats(scan: NmapScanData): string {
  const counts = {
    critical: scan.vulnerabilities.filter(v => v.severity === 'critical').length,
    high: scan.vulnerabilities.filter(v => v.severity === 'high').length,
    medium: scan.vulnerabilities.filter(v => v.severity === 'medium').length,
    low: scan.vulnerabilities.filter(v => v.severity === 'low').length,
    ports: scan.ports.filter(p => p.state === 'open').length,
  }

  return `
    <div class="summary-stat">
      <div class="value" style="color: ${SEVERITY_COLORS.critical.bg}">${counts.critical}</div>
      <div class="label">Critical</div>
    </div>
    <div class="summary-stat">
      <div class="value" style="color: ${SEVERITY_COLORS.high.bg}">${counts.high}</div>
      <div class="label">High</div>
    </div>
    <div class="summary-stat">
      <div class="value" style="color: ${SEVERITY_COLORS.medium.bg}">${counts.medium}</div>
      <div class="label">Medium</div>
    </div>
    <div class="summary-stat">
      <div class="value" style="color: ${SEVERITY_COLORS.low.bg}">${counts.low}</div>
      <div class="label">Low</div>
    </div>
    <div class="summary-stat">
      <div class="value" style="color: #c4b5fd">${counts.ports}</div>
      <div class="label">Open Ports</div>
    </div>
  `
}

function generateOwaspGrid(categories: string[]): string {
  const allCategories = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10']
  
  return allCategories.map(cat => {
    const found = categories.includes(cat)
    return `
      <div class="owasp-cell ${found ? 'found' : ''}">
        <div class="code">${cat}</div>
        <div>${OWASP_NAMES[cat] || ''}</div>
      </div>
    `
  }).join('')
}

function generateVulnRow(vuln: VulnerabilityResult, analyses: Array<{ vulnerabilityId: string; remediationSteps: string[] }>): string {
  const colors = SEVERITY_COLORS[vuln.severity] || SEVERITY_COLORS.info
  const analysis = analyses.find(a => a.vulnerabilityId === vuln.id)
  
  return `
    <tr>
      <td>
        <span class="severity-badge" style="background: ${colors.bg}; color: ${colors.text}">
          ${vuln.severity}
        </span>
      </td>
      <td style="font-size: 11px;">${vuln.cve || '—'}</td>
      <td>
        <strong>${escapeHtml(vuln.title)}</strong>
        <div style="font-size: 11px; color: #a0a0a0; margin-top: 4px;">
          ${escapeHtml(vuln.description)}
        </div>
        ${analysis?.remediationSteps.length ? `
          <div class="remediation">
            <h4>Remediation</h4>
            <ul>
              ${analysis.remediationSteps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </td>
      <td>${vuln.port || '—'}</td>
      <td style="font-size: 11px;">${escapeHtml(vuln.service || '—')}</td>
    </tr>
  `
}

function generateRemediationSection(scan: NmapScanData): string {
  if (!scan.llmAnalysis?.analyses.length) return ''
  
  // Group by severity order
  const severityOrder = ['critical', 'high', 'medium', 'low', 'info']
  const vulnsByPriority: { vuln: VulnerabilityResult; analysis: typeof scan.llmAnalysis.analyses[0] }[] = []
  
  for (const analysis of scan.llmAnalysis.analyses) {
    const vuln = scan.vulnerabilities.find(v => v.id === analysis.vulnerabilityId)
    if (vuln && analysis.remediationSteps.length) {
      vulnsByPriority.push({ vuln, analysis })
    }
  }
  
  // Sort by severity
  vulnsByPriority.sort((a, b) => 
    severityOrder.indexOf(a.vuln.severity) - severityOrder.indexOf(b.vuln.severity)
  )
  
  return vulnsByPriority.map(({ vuln, analysis }, index) => {
    const colors = SEVERITY_COLORS[vuln.severity] || SEVERITY_COLORS.info
    return `
      <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #2a2a2a;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
          <span style="font-size: 18px; color: #606060; font-weight: bold;">#${index + 1}</span>
          <span class="severity-badge" style="background: ${colors.bg}; color: ${colors.text}">${vuln.severity}</span>
          <strong>${escapeHtml(vuln.title)}</strong>
        </div>
        <ul style="margin-left: 40px; font-size: 12px;">
          ${analysis.remediationSteps.map((step: string) => `<li style="margin-bottom: 4px;">${escapeHtml(step)}</li>`).join('')}
        </ul>
      </div>
    `
  }).join('')
}

// Export report to file
export async function exportReport(options: ReportOptions): Promise<ReportResult> {
  try {
    const html = generateHtmlReport(options.scan)
    
    // Show save dialog
    const result = await dialog.showSaveDialog({
      title: 'Export Security Report',
      defaultPath: `security-report-${options.scan.target.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.html`,
      filters: [
        { name: 'HTML Files', extensions: ['html'] },
      ],
    })
    
    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Export cancelled' }
    }
    
    // Write file
    await fs.writeFile(result.filePath, html, 'utf-8')
    
    // Save metadata for the report
    const metadata: ReportMetadata = {
      id: `report-${Date.now()}`,
      target: options.scan.target,
      scanTimestamp: options.scan.timestamp,
      exportedAt: new Date().toISOString(),
      filePath: result.filePath,
      format: 'html',
      vulnerabilityCount: options.scan.vulnerabilities.length,
      securityScore: options.scan.securityScore?.overall,
      grade: options.scan.securityScore?.grade,
    }
    
    await saveReportMetadata(metadata)
    
    // Open in default browser
    shell.openPath(result.filePath)
    
    return { success: true, filePath: result.filePath, reportId: metadata.id }
  } catch (error) {
    console.error('[Report] Export failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// Save report metadata to JSON file
export async function saveReportMetadata(metadata: ReportMetadata): Promise<void> {
  try {
    const reportsDir = getReportsDir()
    await fs.mkdir(reportsDir, { recursive: true })
    
    const metadataPath = getMetadataPath()
    let reports: ReportMetadata[] = []
    
    try {
      const existing = await fs.readFile(metadataPath, 'utf-8')
      reports = JSON.parse(existing)
    } catch {
      // File doesn't exist yet, start with empty array
    }
    
    // Add new report at the beginning
    reports.unshift(metadata)
    
    // Keep only last 50 reports
    if (reports.length > 50) {
      reports = reports.slice(0, 50)
    }
    
    await fs.writeFile(metadataPath, JSON.stringify(reports, null, 2), 'utf-8')
    console.log('[Report] Metadata saved:', metadata.id)
  } catch (error) {
    console.error('[Report] Failed to save metadata:', error)
  }
}

// Get report history
export async function getReportHistory(): Promise<ReportMetadata[]> {
  try {
    const metadataPath = getMetadataPath()
    const data = await fs.readFile(metadataPath, 'utf-8')
    return JSON.parse(data)
  } catch {
    // No reports yet
    return []
  }
}

// Delete a report (remove from history and optionally delete file)
export async function deleteReport(id: string, deleteFile = false): Promise<boolean> {
  try {
    const metadataPath = getMetadataPath()
    const data = await fs.readFile(metadataPath, 'utf-8')
    const reports: ReportMetadata[] = JSON.parse(data)
    
    const report = reports.find(r => r.id === id)
    if (!report) return false
    
    // Remove from list
    const filtered = reports.filter(r => r.id !== id)
    await fs.writeFile(metadataPath, JSON.stringify(filtered, null, 2), 'utf-8')
    
    // Optionally delete the actual file
    if (deleteFile && report.filePath) {
      try {
        await fs.unlink(report.filePath)
      } catch {
        // File might not exist anymore
      }
    }
    
    return true
  } catch {
    return false
  }
}

// Open a report file
export async function openReport(id: string): Promise<boolean> {
  try {
    const reports = await getReportHistory()
    const report = reports.find(r => r.id === id)
    
    if (report?.filePath) {
      await shell.openPath(report.filePath)
      return true
    }
    return false
  } catch {
    return false
  }
}
