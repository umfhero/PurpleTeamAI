import { useState, useEffect } from 'react'
import { FileText, Download, Loader2, AlertTriangle, FileSearch, Calendar, Trash2 } from 'lucide-react'
import type { NmapScanData } from '../types/electron.d'

// Get grade color based on security grade
function getGradeColor(grade?: string): string {
  if (!grade) return 'text-muted-foreground'
  if (grade === 'A+' || grade === 'A') return 'text-[oklch(0.55_0.15_150)]'
  if (grade === 'B') return 'text-[oklch(0.70_0.15_85)]'
  if (grade === 'C') return 'text-[oklch(0.65_0.25_45)]'
  return 'text-[oklch(0.55_0.22_25)]'
}

interface PentestReport {
  id: string
  target: string
  scanTimestamp: string
  filePath: string
  vulnerabilityCount: number
  securityScore?: number
  grade?: string
  preview?: string
}

export default function Reports() {
  const [scanHistory, setScanHistory] = useState<NmapScanData[]>([])
  const [selectedScan, setSelectedScan] = useState<NmapScanData | null>(null)
  const [reportContent, setReportContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; scan: NmapScanData } | null>(null)

  useEffect(() => {
    loadScanHistory()
  }, [])

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu])

  const loadScanHistory = async () => {
    try {
      if (window.electronAPI?.scanner) {
        const scans = await window.electronAPI.scanner.getHistory()
        // Sort by timestamp (newest first)
        const sortedScans = scans.sort((a, b) => {
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        })
        setScanHistory(sortedScans)

        // Auto-select first scan
        if (sortedScans.length > 0) {
          await selectScan(sortedScans[0])
        }
      }
    } catch (error) {
      console.error('Failed to load scan history:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectScan = async (scan: NmapScanData) => {
    setSelectedScan(scan)
    setReportContent(null)
    await generateReportPreview(scan)
  }

  const generateReportPreview = async (scan: NmapScanData) => {
    setGenerating(true)
    try {
      if (!window.electronAPI?.report) {
        console.error('electronAPI.report not available')
        return
      }

      console.log('Generating pentest report for:', scan.target)

      // Generate the pentest report and get the file path
      const result = await window.electronAPI.report.generatePentest(scan)

      console.log('Generate pentest result:', result)

      if (result.success && result.filePath) {
        console.log('Report generated successfully at:', result.filePath)
        setReportContent(result.filePath)
      } else {
        console.error('Report generation failed:', result.error)
      }
    } catch (error) {
      console.error('Failed to generate report preview:', error)
    } finally {
      setGenerating(false)
    }
  }

  const handleViewFullReport = async () => {
    if (!selectedScan || !reportContent || !window.electronAPI?.report) return

    try {
      // Call a new IPC method to open the report
      const result = await window.electronAPI.report.openFile(reportContent)
      if (!result) {
        console.error('Failed to open report file')
      }
    } catch (error) {
      console.error('Failed to open report:', error)
    }
  }

  const handleExportReport = async () => {
    if (!selectedScan || !window.electronAPI?.report) return

    setExporting(true)
    try {
      const result = await window.electronAPI.report.exportPentest(selectedScan)
      if (result.success) {
        console.log('Report exported:', result.filePath)
      }
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setExporting(false)
    }
  }

  const handleContextMenu = (e: React.MouseEvent, scan: NmapScanData) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, scan })
  }

  const handleDeleteScan = async (scan: NmapScanData) => {
    if (!window.electronAPI?.scanner) return

    try {
      await window.electronAPI.scanner.deleteScan(scan.timestamp)
      const updatedScans = scanHistory.filter(s => s.timestamp !== scan.timestamp)
      setScanHistory(updatedScans)

      if (selectedScan?.timestamp === scan.timestamp) {
        if (updatedScans.length > 0) {
          await selectScan(updatedScans[0])
        } else {
          setSelectedScan(null)
          setReportContent(null)
        }
      }

      setContextMenu(null)
    } catch (error) {
      console.error('Failed to delete scan:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Sidebar - Scan History */}
      <aside className="w-80 border-r border-border bg-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Penetration Test Reports ({scanHistory.length})
          </h3>
          <p className="text-[10px] text-muted-foreground mt-1 font-mono">
            Professional technical write-ups
          </p>
        </div>

        {scanHistory.length > 0 ? (
          <div className="flex-1 overflow-auto">
            {scanHistory.map((scan) => {
              const isSelected = selectedScan?.timestamp === scan.timestamp
              const vulnCount = scan.vulnerabilities.length
              const criticalCount = scan.vulnerabilities.filter(v => v.severity === 'critical').length
              const highCount = scan.vulnerabilities.filter(v => v.severity === 'high').length

              return (
                <button
                  key={scan.timestamp}
                  onClick={() => selectScan(scan)}
                  onContextMenu={(e) => handleContextMenu(e, scan)}
                  className={`w-full text-left p-4 border-b border-border transition-colors ${isSelected
                    ? 'bg-primary/10 border-l-4 border-l-primary'
                    : 'hover:bg-muted/30'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm font-semibold truncate">
                        {scan.target}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground font-mono">
                        <Calendar className="w-3 h-3" />
                        {new Date(scan.timestamp).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-xs font-mono font-bold ${getGradeColor(scan.securityScore?.grade)}`}>
                          {scan.securityScore?.grade || '—'}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {vulnCount} finding{vulnCount !== 1 ? 's' : ''}
                        </span>
                        {criticalCount > 0 && (
                          <span className="text-[10px] text-[oklch(0.55_0.22_25)] font-mono font-bold">
                            {criticalCount}C
                          </span>
                        )}
                        {highCount > 0 && (
                          <span className="text-[10px] text-[oklch(0.65_0.25_45)] font-mono font-bold">
                            {highCount}H
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-xs text-muted-foreground text-center font-mono">
              No reports available
            </p>
          </div>
        )}
      </aside>

      {/* Main Content - Report Display */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedScan ? (
          <>
            {/* Report Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="font-mono font-semibold">
                    Penetration Test Report: {selectedScan.target}
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    {new Date(selectedScan.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {reportContent && (
                  <button
                    onClick={handleViewFullReport}
                    className="flex items-center gap-2 px-4 py-2 border border-border hover:border-primary 
                             hover:text-primary transition-colors font-mono text-xs uppercase tracking-wider"
                  >
                    <FileSearch className="w-4 h-4" />
                    View Full Report
                  </button>
                )}
                <button
                  onClick={handleExportReport}
                  disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground
                           font-mono text-xs uppercase tracking-wider hover:bg-primary/90 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Export Report
                </button>
              </div>
            </div>

            {/* Report Preview/Summary */}
            <div className="flex-1 overflow-auto p-6">
              {generating ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                  <p className="text-sm text-muted-foreground font-mono">
                    Generating professional pentest report...
                  </p>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Report Summary */}
                  <div className="border border-border bg-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Report Summary</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground font-mono uppercase">Target</div>
                        <div className="text-sm font-mono mt-1">{selectedScan.target}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground font-mono uppercase">Scan Date</div>
                        <div className="text-sm font-mono mt-1">
                          {new Date(selectedScan.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground font-mono uppercase">Security Grade</div>
                        <div className={`text-2xl font-bold mt-1 ${getGradeColor(selectedScan.securityScore?.grade)}`}>
                          {selectedScan.securityScore?.grade || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground font-mono uppercase">  Security Score</div>
                        <div className="text-2xl font-bold mt-1">
                          {selectedScan.securityScore?.overall ?? '—'}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Findings Summary */}
                  <div className="border border-border bg-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Findings Overview</h3>
                    <div className="grid grid-cols-5 gap-4">
                      {(['critical', 'high', 'medium', 'low', 'info'] as const).map((severity) => {
                        const count = selectedScan.vulnerabilities.filter(v => v.severity === severity).length
                        const colors = {
                          critical: 'text-[oklch(0.55_0.22_25)]',
                          high: 'text-[oklch(0.65_0.25_45)]',
                          medium: 'text-[oklch(0.70_0.15_85)]',
                          low: 'text-[oklch(0.55_0.15_150)]',
                          info: 'text-muted-foreground',
                        }
                        return (
                          <div key={severity} className="text-center">
                            <div className={`text-3xl font-bold ${colors[severity]}`}>{count}</div>
                            <div className="text-xs uppercase text-muted-foreground mt-1">{severity}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Report Sections */}
                  <div className="border border-border bg-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Report Contents</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center font-mono text-xs font-bold text-primary">
                          1
                        </div>
                        <div>
                          <div className="font-semibold">Executive Summary</div>
                          <div className="text-xs text-muted-foreground">
                            High-level overview for management and stakeholders
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center font-mono text-xs font-bold text-primary">
                          2
                        </div>
                        <div>
                          <div className="font-semibold">Scope and Methodology</div>
                          <div className="text-xs text-muted-foreground">
                            Testing parameters, tools, and techniques used
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center font-mono text-xs font-bold text-primary">
                          3
                        </div>
                        <div>
                          <div className="font-semibold">Findings Summary Table</div>
                          <div className="text-xs text-muted-foreground">
                            Complete list of {selectedScan.vulnerabilities.length} vulnerabilities identified
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center font-mono text-xs font-bold text-primary">
                          4
                        </div>
                        <div>
                          <div className="font-semibold">Detailed Technical Findings</div>
                          <div className="text-xs text-muted-foreground">
                            In-depth analysis with evidence and remediation steps
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center font-mono text-xs font-bold text-primary">
                          5
                        </div>
                        <div>
                          <div className="font-semibold">Technical Appendix</div>
                          <div className="text-xs text-muted-foreground">
                            Network services, open ports, and testing tools
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center font-mono text-xs font-bold text-primary">
                          6
                        </div>
                        <div>
                          <div className="font-semibold">Conclusion and Recommendations</div>
                          <div className="text-xs text-muted-foreground">
                            Strategic advice and next steps
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Info */}
                  <div className="bg-muted/50 border border-border p-4 rounded">
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold mb-1">Professional Technical Write-up</p>
                        <p className="text-muted-foreground text-xs">
                          This report follows industry-standard penetration testing report structures and includes
                          executive summaries, technical details, risk assessments, and remediation recommendations.
                          Click <strong>"View Full Report"</strong> to open the complete PDF document,
                          or <strong>"Export Report"</strong> to save a copy to your preferred location.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Reports Available</h3>
              <p className="text-muted-foreground text-sm font-mono mb-6">
                Run a scan from the Scan Target page to generate professional penetration test reports.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Custom Context Menu */}
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
            Delete Report
          </button>
        </div>
      )}
    </div>
  )
}
