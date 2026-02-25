import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import {
  FileText, Download, Loader2, AlertTriangle, Trash2,
  ChevronDown, ChevronRight, Minus, TrendingUp, TrendingDown, GitCompare
} from 'lucide-react'
import type { NmapScanData } from '../types/electron.d'
import type { TargetGroup, ScanDeltaChain } from '../types/delta'
import NotificationBadge from '../components/NotificationBadge'

function getGradeColor(grade?: string): string {
  if (!grade) return 'text-muted-foreground'
  if (grade === 'A+' || grade === 'A') return 'text-[oklch(0.55_0.15_150)]'
  if (grade === 'B') return 'text-[oklch(0.70_0.15_85)]'
  if (grade === 'C') return 'text-[oklch(0.65_0.25_45)]'
  return 'text-[oklch(0.55_0.22_25)]'
}

export default function Reports() {
  const location = useLocation()

  const [targetGroups, setTargetGroups] = useState<TargetGroup[]>([])
  const [expandedTarget, setExpandedTarget] = useState<string | null>(null)
  const [deltaChain, setDeltaChain] = useState<ScanDeltaChain | null>(null)

  const [selectedScan, setSelectedScan] = useState<NmapScanData | null>(null)
  const [viewMode, setViewMode] = useState<'full' | 'comparison'>('full')
  const [selectedDelta, setSelectedDelta] = useState<{ olderTimestamp: string; newerTimestamp: string } | null>(null)

  const [reportFilePath, setReportFilePath] = useState<string | null>(null)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; scan: NmapScanData } | null>(null)
  const prevBlobUrl = useRef<string | null>(null)

  // ── context menu dismiss ──────────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu])

  // ── PDF loader helper ─────────────────────────────────────────────────────
  const loadPdfFromPath = async (filePath: string) => {
    if (!window.electronAPI?.report) return
    const pdfResult = await window.electronAPI.report.readPdf(filePath)
    if (pdfResult.success && pdfResult.data) {
      if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current)
      const byteCharacters = atob(pdfResult.data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setPdfBlobUrl(url)
      prevBlobUrl.current = url
    }
  }

  // ── load groups ───────────────────────────────────────────────────────────
  const loadGroups = useCallback(async (opts?: { selectTimestamp?: string }) => {
    try {
      if (!window.electronAPI?.scanner) return
      const groups = await window.electronAPI.scanner.getGroupedHistory()
      setTargetGroups(groups)
      if (groups.length === 0) { setLoading(false); return }

      // Honour navigation state (timestamp passed from Dashboard "View Report")
      const navState = location.state as { scanTimestamp?: string } | null
      const navTs = opts?.selectTimestamp ?? navState?.scanTimestamp
      let targetGroup = groups[0]
      let targetScan = targetGroup.scans[0]
      if (navTs) {
        for (const g of groups) {
          const found = g.scans.find(s => s.timestamp === navTs)
          if (found) { targetGroup = g; targetScan = found; break }
        }
      }

      setExpandedTarget(targetGroup.target)
      await loadDeltaChainFor(targetGroup.target)
      await selectFullReport(targetScan)
    } catch (error) {
      console.error('Failed to load grouped scan history:', error)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  useEffect(() => { loadGroups() }, [loadGroups])

  const loadDeltaChainFor = async (target: string) => {
    if (!window.electronAPI?.scanner) return
    try {
      const chain = await window.electronAPI.scanner.getDeltas(target)
      setDeltaChain(chain)
    } catch (err) {
      console.error('Failed to load deltas:', err)
    }
  }

  // ── select full scan report ───────────────────────────────────────────────
  const selectFullReport = async (scan: NmapScanData) => {
    setSelectedScan(scan)
    setViewMode('full')
    setSelectedDelta(null)
    setReportFilePath(null)
    setPdfBlobUrl(null)
    setGenerating(true)
    try {
      if (!window.electronAPI?.report) return
      const result = await window.electronAPI.report.generatePentest(scan)
      if (result.success && result.filePath) {
        setReportFilePath(result.filePath)
        await loadPdfFromPath(result.filePath)
      }
    } catch (error) {
      console.error('Failed to generate report:', error)
    } finally {
      setGenerating(false)
    }
  }

  // ── select comparison (delta) report ─────────────────────────────────────
  const selectComparisonReport = async (olderTs: string, newerTs: string) => {
    setViewMode('comparison')
    setSelectedDelta({ olderTimestamp: olderTs, newerTimestamp: newerTs })
    setSelectedScan(null)
    setReportFilePath(null)
    setPdfBlobUrl(null)
    setGenerating(true)
    try {
      if (!window.electronAPI?.report) return
      const result = await window.electronAPI.report.generateDelta(olderTs, newerTs)
      if (result.noChanges) { setGenerating(false); return }
      if (result.success && result.filePath) {
        setReportFilePath(result.filePath)
        await loadPdfFromPath(result.filePath)
      }
    } catch (error) {
      console.error('Failed to generate delta report:', error)
    } finally {
      setGenerating(false)
    }
  }

  // ── group expand ──────────────────────────────────────────────────────────
  const handleGroupClick = async (target: string) => {
    if (expandedTarget === target) {
      setExpandedTarget(null)
    } else {
      setExpandedTarget(target)
      const group = targetGroups.find(g => g.target === target)
      if (group) {
        setDeltaChain(null)
        await loadDeltaChainFor(target)
        await selectFullReport(group.scans[0])
      }
    }
  }

  // ── download ──────────────────────────────────────────────────────────────
  const handleDownloadReport = async () => {
    if (!window.electronAPI?.report) return
    setExporting(true)
    try {
      if (viewMode === 'comparison' && selectedDelta) {
        await window.electronAPI.report.exportDelta(selectedDelta.olderTimestamp, selectedDelta.newerTimestamp)
      } else if (viewMode === 'full' && selectedScan) {
        await window.electronAPI.report.exportPentest(selectedScan)
      }
    } catch (error) {
      console.error('Download failed:', error)
    } finally {
      setExporting(false)
    }
  }

  // ── delete ────────────────────────────────────────────────────────────────
  const handleDeleteScan = async (scan: NmapScanData) => {
    if (!window.electronAPI?.scanner) return
    try {
      await window.electronAPI.scanner.deleteScan(scan.timestamp)
      setContextMenu(null)
      const groups = await window.electronAPI.scanner.getGroupedHistory()
      setTargetGroups(groups)

      const wasSelected =
        (viewMode === 'full' && selectedScan?.timestamp === scan.timestamp) ||
        (viewMode === 'comparison' &&
          (selectedDelta?.olderTimestamp === scan.timestamp || selectedDelta?.newerTimestamp === scan.timestamp))

      if (wasSelected) {
        const group = groups.find(g => g.target === scan.target)
        if (group && group.scans.length > 0) {
          setExpandedTarget(group.target)
          setDeltaChain(null)
          await loadDeltaChainFor(group.target)
          await selectFullReport(group.scans[0])
        } else if (groups.length > 0) {
          setExpandedTarget(groups[0].target)
          setDeltaChain(null)
          await loadDeltaChainFor(groups[0].target)
          await selectFullReport(groups[0].scans[0])
        } else {
          setSelectedScan(null)
          setSelectedDelta(null)
          setViewMode('full')
          setReportFilePath(null)
          if (prevBlobUrl.current) { URL.revokeObjectURL(prevBlobUrl.current); prevBlobUrl.current = null }
          setPdfBlobUrl(null)
          setDeltaChain(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete scan:', error)
    }
  }

  // ── loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  const expandedGroup = targetGroups.find(g => g.target === expandedTarget)

  const getScanLabel = (timestamp: string) => {
    if (!expandedGroup) return timestamp
    const idx = expandedGroup.scans.findIndex(s => s.timestamp === timestamp)
    if (idx === -1) return timestamp
    return idx === 0 ? 'Latest' : `Scan ${expandedGroup.count - idx}`
  }

  return (
    <div className="flex h-full">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-72 border-r border-border bg-card flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-border">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Reports</h3>
        </div>

        {targetGroups.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-xs text-muted-foreground text-center font-mono">No reports available</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {targetGroups.map((group) => {
              const isExpanded = expandedTarget === group.target
              const latestScan = group.scans[0]
              const chain = isExpanded ? deltaChain : null

              return (
                <div key={group.target} className="border-b border-border">
                  {/* ── Group header ── */}
                  <button
                    onClick={() => handleGroupClick(group.target)}
                    className={`w-full text-left px-3 py-2.5 transition-colors font-mono flex items-start gap-1.5
                      ${isExpanded
                        ? 'bg-muted/40 text-foreground'
                        : 'hover:bg-muted/20 text-muted-foreground hover:text-foreground'}`}
                  >
                    <span className="mt-0.5 flex-shrink-0 text-muted-foreground">
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm truncate flex-1">{group.target}</span>
                        <NotificationBadge count={group.count} />
                      </div>
                      {latestScan && (
                        <div className="text-[10px] mt-0.5 flex gap-1.5 opacity-70">
                          <span className={getGradeColor(group.latestGrade)}>{group.latestGrade ?? '—'}</span>
                          <span>·</span>
                          <span>{new Date(latestScan.timestamp).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* ── Expanded content ── */}
                  {isExpanded && (
                    <div className="bg-muted/10">
                      {/* Interleaved: scan entry, then comparison to next older scan */}
                      {group.scans.map((scan, idx) => {
                        const isSelected = viewMode === 'full' && selectedScan?.timestamp === scan.timestamp
                        const scanLabel = idx === 0 ? 'Latest' : `Scan ${group.count - idx}`
                        const critCount = scan.vulnerabilities.filter(v => v.severity === 'critical').length
                        const highCount = scan.vulnerabilities.filter(v => v.severity === 'high').length

                        // Find the comparison that links this scan (newer) to the next older scan
                        const nextOlderScan = group.scans[idx + 1]
                        const delta = nextOlderScan && chain
                          ? chain.deltas.find(d =>
                              d.olderTimestamp === nextOlderScan.timestamp &&
                              d.newerTimestamp === scan.timestamp)
                          : null

                        return (
                          <div key={scan.timestamp}>
                            {/* ── Scan entry ── */}
                            <button
                              onClick={() => selectFullReport(scan)}
                              onContextMenu={(e) => {
                                e.preventDefault()
                                setContextMenu({ x: e.clientX, y: e.clientY, scan })
                              }}
                              className={`w-full text-left pl-7 pr-3 py-2 border-b border-border/50 transition-colors font-mono text-xs
                                ${isSelected
                                  ? 'bg-primary/10 text-foreground border-l-2 border-l-primary'
                                  : 'hover:bg-muted/30 text-muted-foreground hover:text-foreground'}`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] text-foreground uppercase tracking-wide">{scanLabel}</span>
                                <span className={`text-[10px] font-bold ${getGradeColor(scan.securityScore?.grade)}`}>
                                  {scan.securityScore?.grade ?? '—'}
                                </span>
                              </div>
                              <div className="text-[10px] text-foreground/70 mt-0.5 truncate">
                                {new Date(scan.timestamp).toLocaleString()}
                              </div>
                              <div className="flex gap-1.5 mt-0.5 text-[10px]">
                                {critCount > 0 && <span className="text-[oklch(0.55_0.22_25)]">C:{critCount}</span>}
                                {highCount > 0 && <span className="text-[oklch(0.65_0.25_45)]">H:{highCount}</span>}
                                <span className="text-muted-foreground">{scan.vulnerabilities.length} findings</span>
                              </div>
                            </button>

                            {/* ── Comparison to next older scan (inline) ── */}
                            {delta && (() => {
                              const olderLabel = getScanLabel(delta.olderTimestamp)
                              const newerLabel = getScanLabel(delta.newerTimestamp)
                              const isDeltaSelected =
                                viewMode === 'comparison' &&
                                selectedDelta?.olderTimestamp === delta.olderTimestamp &&
                                selectedDelta?.newerTimestamp === delta.newerTimestamp

                              if (!delta.hasChanges) {
                                return (
                                  <div className="pl-9 pr-3 py-1.5 border-b border-border/50 font-mono text-[10px]
                                                   text-foreground/50 flex items-center gap-1.5 bg-muted/5">
                                    <Minus className="w-3 h-3 flex-shrink-0" />
                                    <span>{olderLabel} → {newerLabel}</span>
                                    <span className="ml-auto italic">No changes</span>
                                  </div>
                                )
                              }

                              return (
                                <button
                                  onClick={() => selectComparisonReport(delta.olderTimestamp, delta.newerTimestamp)}
                                  className={`w-full text-left pl-9 pr-3 py-1.5 border-b border-border/50 transition-colors font-mono text-xs bg-muted/5
                                    ${isDeltaSelected
                                      ? 'bg-primary/10 text-foreground border-l-2 border-l-primary'
                                      : 'hover:bg-muted/30 text-muted-foreground hover:text-foreground'}`}
                                >
                                  <div className="flex items-center gap-1.5 text-[10px]">
                                    <GitCompare className="w-3 h-3 flex-shrink-0 text-foreground/70" />
                                    <span className="text-foreground">{olderLabel}</span>
                                    <span className="text-foreground/50">→</span>
                                    <span className="text-foreground">{newerLabel}</span>
                                  </div>
                                  <div className="flex gap-2 mt-0.5 text-[10px] flex-wrap">
                                    {delta.resolved.length > 0 && (
                                      <span className="text-[oklch(0.55_0.15_150)]">{delta.resolved.length} resolved</span>
                                    )}
                                    {delta.newVulns.length > 0 && (
                                      <span className="text-[oklch(0.55_0.22_25)]">{delta.newVulns.length} new</span>
                                    )}
                                    {delta.persisting.length > 0 && (
                                      <span className="text-foreground/70">{delta.persisting.length} persisting</span>
                                    )}
                                    <span className={`ml-auto flex items-center gap-0.5 font-bold ${
                                      delta.scoreChange > 0
                                        ? 'text-[oklch(0.55_0.15_150)]'
                                        : delta.scoreChange < 0
                                          ? 'text-[oklch(0.55_0.22_25)]'
                                          : 'text-muted-foreground'
                                    }`}>
                                      {delta.scoreChange > 0
                                        ? <TrendingUp className="w-3 h-3" />
                                        : delta.scoreChange < 0
                                          ? <TrendingDown className="w-3 h-3" />
                                          : <Minus className="w-3 h-3" />}
                                      {delta.scoreChange > 0 ? '+' : ''}{delta.scoreChange.toFixed(1)}
                                    </span>
                                  </div>
                                </button>
                              )
                            })()}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {(selectedScan || selectedDelta) ? (
          <>
            {/* Report Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-3">
                {viewMode === 'comparison'
                  ? <GitCompare className="w-5 h-5 text-primary" />
                  : <FileText className="w-5 h-5 text-primary" />}
                <div>
                  {viewMode === 'full' && selectedScan ? (
                    <>
                      <h2 className="font-mono font-semibold">{selectedScan.target}</h2>
                      <p className="text-xs text-muted-foreground font-mono">
                        {new Date(selectedScan.timestamp).toLocaleString()}
                        {selectedScan.securityScore && (
                          <span className={`ml-3 font-bold ${getGradeColor(selectedScan.securityScore.grade)}`}>
                            Grade {selectedScan.securityScore.grade}
                          </span>
                        )}
                        <span className="ml-3">
                          {selectedScan.vulnerabilities.length} finding{selectedScan.vulnerabilities.length !== 1 ? 's' : ''}
                        </span>
                      </p>
                    </>
                  ) : selectedDelta && expandedGroup ? (
                    <>
                      <h2 className="font-mono font-semibold uppercase tracking-wide text-sm">
                        Comparison — {expandedGroup.target}
                      </h2>
                      <p className="text-xs text-muted-foreground font-mono">
                        {getScanLabel(selectedDelta.olderTimestamp)} → {getScanLabel(selectedDelta.newerTimestamp)}
                        {(() => {
                          const delta = deltaChain?.deltas.find(
                            d => d.olderTimestamp === selectedDelta.olderTimestamp &&
                                 d.newerTimestamp === selectedDelta.newerTimestamp
                          )
                          if (!delta) return null
                          return (
                            <>
                              {delta.resolved.length > 0 && (
                                <span className="ml-3 text-[oklch(0.55_0.15_150)]">{delta.resolved.length} resolved</span>
                              )}
                              {delta.newVulns.length > 0 && (
                                <span className="ml-3 text-[oklch(0.55_0.22_25)]">{delta.newVulns.length} new</span>
                              )}
                              {delta.persisting.length > 0 && (
                                <span className="ml-3">{delta.persisting.length} persisting</span>
                              )}
                            </>
                          )
                        })()}
                      </p>
                    </>
                  ) : null}
                </div>
              </div>
              <button
                onClick={handleDownloadReport}
                disabled={exporting || generating}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground
                           font-mono text-xs uppercase tracking-wider hover:bg-primary/90 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download Report
              </button>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 overflow-hidden bg-neutral-900">
              {generating ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                  <p className="text-sm text-muted-foreground font-mono">
                    {viewMode === 'comparison' ? 'Generating comparison report...' : 'Generating report...'}
                  </p>
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  src={pdfBlobUrl}
                  className="w-full h-full border-0"
                  title={viewMode === 'comparison'
                    ? `Comparison Report — ${expandedGroup?.target ?? ''}`
                    : `Penetration Test Report — ${selectedScan?.target ?? ''}`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <AlertTriangle className="w-8 h-8 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground font-mono">Failed to load report preview</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Reports Available</h3>
              <p className="text-muted-foreground text-sm font-mono mb-6">
                Run a scan from the Scan Target page to generate penetration test reports.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-card border border-border shadow-lg z-50 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleDeleteScan(contextMenu.scan)}
            className="w-full text-left px-4 py-2 hover:bg-destructive/10 hover:text-destructive
                       transition-colors flex items-center gap-2 font-mono text-xs"
          >
            <Trash2 className="w-4 h-4" />
            Delete Scan
          </button>
        </div>
      )}
    </div>
  )
}
