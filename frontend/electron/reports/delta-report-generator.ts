// Delta Comparison Report Generator
// Generates a "Summary Report" PDF comparing two sequential scans of the same target.

import { dialog, shell, app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NmapScanData, VulnerabilityResult } from '../scanner/types'
import type { ScanDelta, OWASPDeltaEntry } from '../analysis/delta-types'

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

const SEVERITY_BADGE: Record<string, { cls: string; label: string }> = {
  critical: { cls: 'severity-critical', label: 'CRITICAL' },
  high:     { cls: 'severity-high',     label: 'HIGH' },
  medium:   { cls: 'severity-medium',   label: 'MEDIUM' },
  low:      { cls: 'severity-low',      label: 'LOW' },
  info:     { cls: 'severity-info',     label: 'INFO' },
}

const OWASP_NAMES: Record<string, string> = {
  A01: 'Broken Access Control',       A02: 'Cryptographic Failures',
  A03: 'Injection',                   A04: 'Insecure Design',
  A05: 'Security Misconfiguration',   A06: 'Vulnerable and Outdated Components',
  A07: 'Auth Failures',               A08: 'Data Integrity Failures',
  A09: 'Logging Failures',            A10: 'SSRF',
}

// ---------------------------------------------------------------------------
// Vulnerability row for findings table
// ---------------------------------------------------------------------------

function vulnRow(vuln: VulnerabilityResult, idx: number): string {
  const b = SEVERITY_BADGE[vuln.severity] ?? SEVERITY_BADGE.info
  return `
    <tr${idx % 2 === 1 ? ' class="alt-row"' : ''}>
      <td><span class="${b.cls}">${b.label}</span></td>
      <td class="finding-title-cell">${escapeHtml(vuln.title)}</td>
      <td class="mono-cell">${vuln.port ?? '—'}</td>
      <td class="mono-cell">${vuln.cve ? escapeHtml(vuln.cve) : '—'}</td>
    </tr>`
}

// ---------------------------------------------------------------------------
// Vulnerability detail card (academic style)
// ---------------------------------------------------------------------------

function vulnDetailCard(vuln: VulnerabilityResult, idx: number): string {
  const b = SEVERITY_BADGE[vuln.severity] ?? SEVERITY_BADGE.info
  return `
    <div class="finding-card">
      <div class="finding-header">
        <span class="finding-id">${idx + 1}.</span>
        <span class="finding-title">${escapeHtml(vuln.title)}</span>
        <span class="${b.cls}">${b.label}</span>
      </div>
      <div class="finding-body-simple">
        <p>${escapeHtml(vuln.description)}</p>
        <div class="finding-meta-row">
          ${vuln.port ? `<span><strong>Port:</strong> ${vuln.port}${vuln.service ? ` / ${escapeHtml(vuln.service)}` : ''}</span>` : ''}
          ${vuln.cve ? `<span><strong>CVE:</strong> ${escapeHtml(vuln.cve)}</span>` : ''}
          ${vuln.script ? `<span><strong>Script:</strong> ${escapeHtml(vuln.script)}</span>` : ''}
        </div>
      </div>
    </div>`
}

// ---------------------------------------------------------------------------
// Full HTML document — LaTeX / academic style matching main pentest report
// ---------------------------------------------------------------------------

export function generateDeltaReportHTML(
  delta: ScanDelta,
  olderScan: NmapScanData,
  newerScan: NmapScanData
): string {
  const olderDate = formatDate(delta.olderTimestamp)
  const newerDate = formatDate(delta.newerTimestamp)
  const target = olderScan.target

  const scoreDirection = delta.scoreChange > 0 ? 'Improved' : delta.scoreChange < 0 ? 'Degraded' : 'Unchanged'
  const scoreSign = delta.scoreChange > 0 ? '+' : ''

  // Summary counts by severity
  const countBySeverity = (vulns: VulnerabilityResult[]) =>
    ['critical', 'high', 'medium', 'low', 'info'].map(s => ({
      s, n: vulns.filter(v => v.severity === s).length
    })).filter(x => x.n > 0)

  const resolvedBySev = countBySeverity(delta.resolved)
  const newBySev = countBySeverity(delta.newVulns)
  const persistingBySev = countBySeverity(delta.persisting)

  // Sort all vuln lists by severity
  const sortedResolved = [...delta.resolved].sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))
  const sortedNew = [...delta.newVulns].sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))
  const sortedPersisting = [...delta.persisting].sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))

  // OWASP table rows
  const owaspRows = delta.owaspDelta.map((e: OWASPDeltaEntry, i: number) => {
    const change = e.change
    const changeStr = change > 0 ? `+${change}` : String(change)
    const id = e.category.toString()
    return `
      <tr${i % 2 === 1 ? ' class="alt-row"' : ''}>
        <td class="mono-cell">${id}</td>
        <td>${OWASP_NAMES[id] ?? id}</td>
        <td style="text-align:center;">${e.oldCount}</td>
        <td style="text-align:center;">${e.newCount}</td>
        <td style="text-align:center; font-weight:700;">${changeStr}</td>
      </tr>`
  }).join('')

  // Severity breakdown helper
  const sevBreakdownText = (items: { s: string; n: number }[]) =>
    items.map(({ s, n }) => `${n} ${s}`).join(', ')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scan Comparison — ${escapeHtml(target)}</title>
  <style>
    @page {
      margin: 2cm 2cm 2.5cm 2cm;
      size: A4;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, 'Times New Roman', serif;
      line-height: 1.65;
      color: #2c2c2c;
      background: #ffffff;
      padding: 20px;
      font-size: 11px;
      max-width: 960px;
      margin: 0 auto;
    }

    /* ── Cover ── */
    .cover {
      page-break-after: always;
      text-align: center;
      padding: 80px 40px 60px;
      border-top: 3px double #333;
      border-bottom: 3px double #333;
      margin: 60px 20px 0;
    }
    .cover h1 {
      font-size: 28px;
      margin-bottom: 6px;
      color: #1a1a1a;
      letter-spacing: 3px;
      font-weight: 700;
    }
    .cover h2 {
      font-size: 18px;
      margin-bottom: 30px;
      color: #555;
      font-weight: 400;
      font-style: italic;
    }
    .cover .meta {
      font-size: 12px;
      color: #555;
      margin-top: 50px;
      line-height: 2;
    }
    .cover .meta div { margin: 4px 0; }
    .cover .score-box {
      display: inline-block;
      padding: 10px 36px;
      font-size: 16px;
      font-weight: 700;
      margin: 20px 0;
      letter-spacing: 2px;
      border: 2px solid #333;
      background: transparent;
      color: #1a1a1a;
    }

    /* ── Table of Contents ── */
    .toc {
      page-break-after: always;
      padding: 30px 0;
    }
    .toc h2 {
      font-size: 22px;
      margin-bottom: 24px;
      color: #1a1a1a;
      border-bottom: 1px solid #999;
      padding-bottom: 8px;
      font-variant: small-caps;
      letter-spacing: 1px;
    }
    .toc ul { list-style: none; margin-left: 0; }
    .toc li {
      margin: 10px 0;
      font-size: 12px;
      line-height: 1.8;
    }
    .toc .section-number {
      display: inline-block;
      width: 36px;
      font-weight: 700;
    }

    /* ── Section headings ── */
    .section { margin: 30px 0; }
    .section-new-page { page-break-before: always; }
    .section h2 {
      font-size: 20px;
      margin-top: 36px;
      margin-bottom: 16px;
      color: #1a1a1a;
      border-bottom: 1px solid #999;
      padding-bottom: 6px;
      font-variant: small-caps;
      letter-spacing: 1px;
    }
    .section h3 {
      font-size: 15px;
      margin-top: 22px;
      margin-bottom: 10px;
      color: #2c2c2c;
      font-style: italic;
    }
    .section p {
      margin: 10px 0;
      text-align: justify;
      font-size: 11px;
      hyphens: auto;
    }

    /* ── Summary table ── */
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 11px;
    }
    .summary-table th {
      background: #2c2c2c;
      color: #f0f0f0;
      padding: 8px 16px;
      text-align: center;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 9px;
      letter-spacing: 1px;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .summary-table td {
      padding: 10px 16px;
      text-align: center;
      border-bottom: 1px solid #ddd;
      font-size: 13px;
    }
    .summary-table .big-number {
      font-size: 22px;
      font-weight: 700;
      color: #1a1a1a;
    }
    .summary-table .alt-row td { background: #f4f4f2; }

    /* ── Risk info box ── */
    .info-box {
      background: #f8f8f5;
      padding: 14px 20px;
      border-left: 3px solid #555;
      margin: 18px 0;
      font-size: 11px;
      line-height: 1.7;
    }

    /* ── Findings tables ── */
    .findings-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 10px;
    }
    .findings-table th {
      background: #2c2c2c;
      color: #f0f0f0;
      padding: 8px 10px;
      text-align: left;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 8px;
      letter-spacing: 1px;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .findings-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #ddd;
      vertical-align: middle;
    }
    .findings-table .alt-row { background: #fafaf8; }
    .mono-cell {
      font-family: 'Consolas', 'Fira Code', monospace;
      font-size: 9px;
      color: #555;
    }
    .finding-title-cell {
      font-weight: 600;
      color: #1a1a1a;
    }

    /* ── Finding detail cards ── */
    .finding-card {
      page-break-inside: avoid;
      margin: 14px 0;
      border: 1px solid #ccc;
      border-left: 3px solid #333;
      background: #fdfdfd;
    }
    .finding-header {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 10px 14px;
      background: #f4f4f2;
      border-bottom: 1px solid #ddd;
    }
    .finding-id {
      font-size: 10px;
      color: #888;
      font-weight: 700;
      font-family: 'Consolas', monospace;
    }
    .finding-title {
      font-size: 13px;
      font-weight: 700;
      color: #1a1a1a;
      flex: 1;
    }
    .finding-body-simple {
      padding: 10px 14px;
      font-size: 10px;
      line-height: 1.6;
      color: #444;
    }
    .finding-body-simple p { margin: 0 0 6px; text-align: justify; }
    .finding-meta-row {
      display: flex;
      gap: 18px;
      margin-top: 6px;
      font-size: 9px;
      color: #777;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .finding-meta-row strong { color: #555; }

    /* ── Severity badges (muted, paper-friendly) ── */
    .severity-critical { display:inline-block; padding:2px 10px; font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:1px; font-family:'Segoe UI',Arial,sans-serif; background:#f2d4d4; color:#6b1c1c; border:1px solid #d4a0a0; border-radius:2px; }
    .severity-high     { display:inline-block; padding:2px 10px; font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:1px; font-family:'Segoe UI',Arial,sans-serif; background:#f5e0d0; color:#7a3a14; border:1px solid #d4b89c; border-radius:2px; }
    .severity-medium   { display:inline-block; padding:2px 10px; font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:1px; font-family:'Segoe UI',Arial,sans-serif; background:#f5efd0; color:#6b5c14; border:1px solid #d4c88c; border-radius:2px; }
    .severity-low      { display:inline-block; padding:2px 10px; font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:1px; font-family:'Segoe UI',Arial,sans-serif; background:#d4ecd4; color:#1c5e1c; border:1px solid #a0c8a0; border-radius:2px; }
    .severity-info     { display:inline-block; padding:2px 10px; font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:1px; font-family:'Segoe UI',Arial,sans-serif; background:#d4dff2; color:#1c3a6b; border:1px solid #a0b8d4; border-radius:2px; }

    /* ── OWASP table ── */
    .owasp-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 10px;
    }
    .owasp-table th {
      background: #f4f4f2;
      padding: 8px 10px;
      text-align: left;
      font-weight: 700;
      border-bottom: 2px solid #555;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .owasp-table td {
      padding: 7px 10px;
      border-bottom: 1px solid #e0e0e0;
    }
    .owasp-table .alt-row { background: #fafaf8; }

    /* ── Footer ── */
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #bbb;
      font-size: 9px;
      color: #888;
      text-align: center;
      font-style: italic;
    }

    .page-watermark {
      position: fixed;
      bottom: 8px;
      right: 24px;
      font-size: 8px;
      color: #ccc;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-style: italic;
      letter-spacing: 0.5px;
    }

    @media print {
      body { padding: 0; }
      .finding-card { page-break-inside: avoid; }
      .section h2 { page-break-after: avoid; }
      .section-new-page { page-break-before: always; }
      .page-watermark { display: none; }
    }
  </style>
</head>
<body>

  <!-- ═══════════════ COVER PAGE ═══════════════ -->
  <div class="cover">
    <h1>SCAN COMPARISON REPORT</h1>
    <h2>${escapeHtml(target)}</h2>

    <div class="score-box">
      SCORE CHANGE: ${scoreSign}${delta.scoreChange.toFixed(1)} &mdash; ${scoreDirection.toUpperCase()}
    </div>

    <div class="meta">
      <div><strong>Baseline Scan:</strong> ${olderDate}</div>
      <div><strong>Latest Scan:</strong> ${newerDate}</div>
      <div><strong>Generated:</strong> ${formatDate(new Date().toISOString())}</div>
      <div><strong>Tool:</strong> PurpleTeam AI Security Scanner</div>
    </div>
  </div>

  <!-- ═══════════════ TABLE OF CONTENTS ═══════════════ -->
  <div class="toc">
    <h2>Table of Contents</h2>
    <ul>
      <li><span class="section-number">1.</span> Executive Summary</li>
      <li><span class="section-number">2.</span> Score Comparison</li>
      <li><span class="section-number">3.</span> Resolved Vulnerabilities (${delta.resolved.length})</li>
      <li><span class="section-number">4.</span> New Vulnerabilities (${delta.newVulns.length})</li>
      <li><span class="section-number">5.</span> Persisting Vulnerabilities (${delta.persisting.length})</li>
      ${delta.owaspDelta.length > 0 ? '<li><span class="section-number">6.</span> OWASP Top 10 Coverage Delta</li>' : ''}
      <li><span class="section-number">${delta.owaspDelta.length > 0 ? '7' : '6'}.</span> Conclusion</li>
    </ul>
  </div>

  <!-- ═══════════════ 1. EXECUTIVE SUMMARY ═══════════════ -->
  <div class="section">
    <h2>1. Executive Summary</h2>
    <p>
      This report presents a comparative analysis between two consecutive security scans of
      <strong>${escapeHtml(target)}</strong>. The baseline scan was conducted on ${olderDate} and the
      follow-up scan on ${newerDate}. The purpose of this comparison is to evaluate the effectiveness
      of remediation efforts and identify any newly introduced security concerns.
    </p>
    <div class="info-box">
      <strong>Key findings:</strong> Between the two scans, <strong>${delta.resolved.length}</strong>
      vulnerabilit${delta.resolved.length === 1 ? 'y was' : 'ies were'} resolved,
      <strong>${delta.newVulns.length}</strong> new finding${delta.newVulns.length === 1 ? ' was' : 's were'}
      introduced, and <strong>${delta.persisting.length}</strong> finding${delta.persisting.length === 1 ? '' : 's'}
      remain${delta.persisting.length === 1 ? 's' : ''} unaddressed.
      The overall security score moved from ${delta.olderScore.toFixed(1)} to ${delta.newerScore.toFixed(1)}
      (${scoreSign}${delta.scoreChange.toFixed(1)}).
    </div>

    <table class="summary-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Count</th>
          <th>Severity Breakdown</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="font-weight:600;">Resolved</td>
          <td class="big-number">${delta.resolved.length}</td>
          <td style="font-size:10px;">${resolvedBySev.length ? sevBreakdownText(resolvedBySev) : '—'}</td>
        </tr>
        <tr class="alt-row">
          <td style="font-weight:600;">New</td>
          <td class="big-number">${delta.newVulns.length}</td>
          <td style="font-size:10px;">${newBySev.length ? sevBreakdownText(newBySev) : '—'}</td>
        </tr>
        <tr>
          <td style="font-weight:600;">Persisting</td>
          <td class="big-number">${delta.persisting.length}</td>
          <td style="font-size:10px;">${persistingBySev.length ? sevBreakdownText(persistingBySev) : '—'}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ═══════════════ 2. SCORE COMPARISON ═══════════════ -->
  <div class="section">
    <h2>2. Score Comparison</h2>
    <table class="summary-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Baseline</th>
          <th>Latest</th>
          <th>Change</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="font-weight:600; text-align:left; padding-left:20px;">Security Score</td>
          <td class="big-number">${delta.olderScore.toFixed(1)}</td>
          <td class="big-number">${delta.newerScore.toFixed(1)}</td>
          <td class="big-number">${scoreSign}${delta.scoreChange.toFixed(1)}</td>
        </tr>
        <tr class="alt-row">
          <td style="font-weight:600; text-align:left; padding-left:20px;">Total Findings</td>
          <td>${olderScan.vulnerabilities.length}</td>
          <td>${newerScan.vulnerabilities.length}</td>
          <td>${newerScan.vulnerabilities.length - olderScan.vulnerabilities.length > 0 ? '+' : ''}${newerScan.vulnerabilities.length - olderScan.vulnerabilities.length}</td>
        </tr>
      </tbody>
    </table>
    <p>
      ${delta.scoreChange > 0
        ? `The security posture has improved by ${delta.scoreChange.toFixed(1)} points, indicating that the remediation efforts between the baseline and follow-up scans were effective.`
        : delta.scoreChange < 0
          ? `The security posture has degraded by ${Math.abs(delta.scoreChange).toFixed(1)} points, suggesting that newly introduced findings or expanded attack surface have offset any remediation work.`
          : `The security score remains unchanged between the two scans.`}
    </p>
  </div>

  <!-- ═══════════════ 3. RESOLVED ═══════════════ -->
  <div class="section section-new-page">
    <h2>3. Resolved Vulnerabilities</h2>
    <p>
      The following ${delta.resolved.length} finding${delta.resolved.length === 1 ? ' was' : 's were'}
      present in the baseline scan but ${delta.resolved.length === 1 ? 'is' : 'are'} no longer detected
      in the latest scan. ${delta.resolved.length > 0 ? 'This indicates successful remediation or that the affected service is no longer exposed.' : ''}
    </p>
    ${delta.resolved.length === 0
      ? `<div class="info-box">No vulnerabilities were resolved between these two scans.</div>`
      : `
    <table class="findings-table">
      <thead><tr><th>Severity</th><th>Finding</th><th>Port</th><th>CVE</th></tr></thead>
      <tbody>${sortedResolved.map((v, i) => vulnRow(v, i)).join('')}</tbody>
    </table>
    <h3>Detailed Descriptions</h3>
    ${sortedResolved.map((v, i) => vulnDetailCard(v, i)).join('')}`}
  </div>

  <!-- ═══════════════ 4. NEW ═══════════════ -->
  <div class="section section-new-page">
    <h2>4. New Vulnerabilities</h2>
    <p>
      The following ${delta.newVulns.length} finding${delta.newVulns.length === 1 ? ' was' : 's were'}
      not present in the baseline scan and ${delta.newVulns.length === 1 ? 'has' : 'have'} been
      newly identified. These may represent regressions, newly exposed services, or findings
      uncovered by changes in scan coverage.
    </p>
    ${delta.newVulns.length === 0
      ? `<div class="info-box">No new vulnerabilities were introduced between these two scans.</div>`
      : `
    <table class="findings-table">
      <thead><tr><th>Severity</th><th>Finding</th><th>Port</th><th>CVE</th></tr></thead>
      <tbody>${sortedNew.map((v, i) => vulnRow(v, i)).join('')}</tbody>
    </table>
    <h3>Detailed Descriptions</h3>
    ${sortedNew.map((v, i) => vulnDetailCard(v, i)).join('')}`}
  </div>

  <!-- ═══════════════ 5. PERSISTING ═══════════════ -->
  <div class="section section-new-page">
    <h2>5. Persisting Vulnerabilities</h2>
    <p>
      The following ${delta.persisting.length} finding${delta.persisting.length === 1 ? '' : 's'}
      remain${delta.persisting.length === 1 ? 's' : ''} present across both scans and
      ${delta.persisting.length === 1 ? 'has' : 'have'} not yet been addressed.
      ${delta.persisting.length > 0 ? 'Prioritised remediation is recommended based on severity.' : ''}
    </p>
    ${delta.persisting.length === 0
      ? `<div class="info-box">No persisting vulnerabilities — all findings have been addressed.</div>`
      : `
    <table class="findings-table">
      <thead><tr><th>Severity</th><th>Finding</th><th>Port</th><th>CVE</th></tr></thead>
      <tbody>${sortedPersisting.map((v, i) => vulnRow(v, i)).join('')}</tbody>
    </table>
    <h3>Detailed Descriptions</h3>
    ${sortedPersisting.map((v, i) => vulnDetailCard(v, i)).join('')}`}
  </div>

  <!-- ═══════════════ 6. OWASP DELTA ═══════════════ -->
  ${delta.owaspDelta.length > 0 ? `
  <div class="section section-new-page">
    <h2>6. OWASP Top 10 Coverage Delta</h2>
    <p>
      The table below shows the change in vulnerability count per OWASP Top 10 (2021) category
      between the baseline and latest scans. Negative values indicate remediation progress;
      positive values indicate newly introduced exposure.
    </p>
    <table class="owasp-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Category</th>
          <th style="text-align:center;">Baseline</th>
          <th style="text-align:center;">Latest</th>
          <th style="text-align:center;">Change</th>
        </tr>
      </thead>
      <tbody>${owaspRows}</tbody>
    </table>
  </div>` : ''}

  <!-- ═══════════════ CONCLUSION ═══════════════ -->
  <div class="section section-new-page">
    <h2>${delta.owaspDelta.length > 0 ? '7' : '6'}. Conclusion</h2>
    <p>
      ${delta.scoreChange > 0
        ? `The remediation efforts between the baseline and latest scans have resulted in a measurable improvement to the security posture of ${escapeHtml(target)}. The security score increased from ${delta.olderScore.toFixed(1)} to ${delta.newerScore.toFixed(1)}, a gain of ${delta.scoreChange.toFixed(1)} points. ${delta.resolved.length} finding${delta.resolved.length === 1 ? ' was' : 's were'} resolved.`
        : delta.scoreChange < 0
          ? `The security posture of ${escapeHtml(target)} has degraded since the baseline scan. The security score decreased from ${delta.olderScore.toFixed(1)} to ${delta.newerScore.toFixed(1)}, a decline of ${Math.abs(delta.scoreChange).toFixed(1)} points. ${delta.newVulns.length} new finding${delta.newVulns.length === 1 ? ' was' : 's were'} identified.`
          : `The security posture of ${escapeHtml(target)} remains unchanged between the two scans. No significant changes in vulnerability status were observed.`}
    </p>
    ${delta.persisting.length > 0 ? `
    <p>
      ${delta.persisting.length} finding${delta.persisting.length === 1 ? '' : 's'} remain${delta.persisting.length === 1 ? 's' : ''}
      unaddressed and should be prioritised in subsequent remediation cycles. Continued periodic
      scanning is recommended to track the ongoing effectiveness of security improvements.
    </p>` : `
    <p>
      All previously identified findings have been addressed. Continued periodic scanning is
      recommended to maintain security posture and detect any future regressions.
    </p>`}
    <div class="info-box">
      <em>This report was generated automatically by PurpleTeam Suite. The findings are based on
      automated network and vulnerability scanning using Nmap and should be supplemented with
      manual testing for comprehensive security assurance.</em>
    </div>
  </div>

  <!-- ═══════════════ FOOTER ═══════════════ -->
  <div class="footer">
    PurpleTeam Suite &mdash; Automated Security Comparison Report &mdash; Confidential
  </div>
  <div class="page-watermark">PurpleTeam Suite</div>

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
