import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { FileText, Download, Loader2, AlertTriangle, Calendar, Trash2 } from 'lucide-react'
import type { NmapScanData } from '../types/electron.d'

// Get grade color based on security grade
function getGradeColor(grade?: string): string {
  if (!grade) return 'text-muted-foreground'
  if (grade === 'A+' || grade === 'A') return 'text-[oklch(0.55_0.15_150)]'
  if (grade === 'B') return 'text-[oklch(0.70_0.15_85)]'
  if (grade === 'C') return 'text-[oklch(0.65_0.25_45)]'
  return 'text-[oklch(0.55_0.22_25)]'
}

export default function Reports() {
  const location = useLocation()
  const [scanHistory, setScanHistory] = useState<NmapScanData[]>([])
  const [selectedScan, setSelectedScan] = useState<NmapScanData | null>(null)
  const [reportFilePath, setReportFilePath] = useState<string | null>(null)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; scan: NmapScanData } | null>(null)
  const prevBlobUrl = useRef<string | null>(null)

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

        // Select the scan passed via navigation state, or default to the first
        const navState = location.state as { scanTimestamp?: string } | null
        const targetScan = navState?.scanTimestamp
          ? sortedScans.find(s => s.timestamp === navState.scanTimestamp)
          : null

        if (targetScan) {
          await selectScan(targetScan)
        } else if (sortedScans.length > 0) {
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
    setReportFilePath(null)
    setPdfBlobUrl(null)
    await generateAndLoadReport(scan)
  }

  const generateAndLoadReport = async (scan: NmapScanData) => {
    setGenerating(true)
    try {
      if (!window.electronAPI?.report) {
        console.error('electronAPI.report not available')
        return
      }

      console.log('Generating pentest report for:', scan.target)

      // Generate the pentest report PDF
      const result = await window.electronAPI.report.generatePentest(scan)

      console.log('Generate pentest result:', result)

      if (result.success && result.filePath) {
        console.log('Report generated successfully at:', result.filePath)
        setReportFilePath(result.filePath)

        // Read the PDF and create a blob URL for in-app preview
        const pdfResult = await window.electronAPI.report.readPdf(result.filePath)
        if (pdfResult.success && pdfResult.data) {
          // Revoke previous blob URL to avoid memory leaks
          if (prevBlobUrl.current) {
            URL.revokeObjectURL(prevBlobUrl.current)
          }

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
      } else {
        console.error('Report generation failed:', result.error)
      }
    } catch (error) {
      console.error('Failed to generate report:', error)
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadReport = async () => {
    if (!selectedScan || !window.electronAPI?.report) return

    setExporting(true)
    try {
      const result = await window.electronAPI.report.exportPentest(selectedScan)
      if (result.success) {
        console.log('Report downloaded to:', result.filePath)
      }
    } catch (error) {
      console.error('Download failed:', error)
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
          setReportFilePath(null)
          if (prevBlobUrl.current) {
            URL.revokeObjectURL(prevBlobUrl.current)
            prevBlobUrl.current = null
          }
          setPdfBlobUrl(null)
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

      {/* Main Content - PDF Report Viewer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedScan ? (
          <>
            {/* Report Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="font-mono font-semibold">
                    {selectedScan.target}
                  </h2>
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
                </div>
              </div>
              <button
                onClick={handleDownloadReport}
                disabled={exporting || generating}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground
                         font-mono text-xs uppercase tracking-wider hover:bg-primary/90 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download Report
              </button>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 overflow-hidden bg-neutral-900">
              {generating ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                  <p className="text-sm text-muted-foreground font-mono">
                    Generating report...
                  </p>
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  src={pdfBlobUrl}
                  className="w-full h-full border-0"
                  title={`Penetration Test Report — ${selectedScan.target}`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <AlertTriangle className="w-8 h-8 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground font-mono">
                    Failed to load report preview
                  </p>
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
                Run a scan from the Scan Target page to generate penetration test reports.
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
