import { useState, useEffect } from 'react'
import { FileText, ArrowRight, Loader2, AlertTriangle, FileDown, Calendar, ChevronRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import type { NmapScanData } from '../types/electron.d'
import ReportViewer from '../components/ReportViewer'

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
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    loadScanHistory()
  }, [])

  // Auto-select scan from navigation state
  useEffect(() => {
    const state = location.state as { scanTimestamp?: string } | null
    if (state?.scanTimestamp && scanHistory.length > 0) {
      const scan = scanHistory.find(s => s.timestamp === state.scanTimestamp)
      if (scan) {
        setSelectedScan(scan)
      }
    }
  }, [location.state, scanHistory])

  const loadScanHistory = async () => {
    try {
      if (window.electronAPI?.scanner) {
        const scans = await window.electronAPI.scanner.getHistory()
        setScanHistory(scans)
        
        // Check if we should auto-select from navigation state
        const state = location.state as { scanTimestamp?: string } | null
        if (state?.scanTimestamp) {
          const scan = scans.find(s => s.timestamp === state.scanTimestamp)
          if (scan) {
            setSelectedScan(scan)
          } else if (scans.length > 0) {
            setSelectedScan(scans[0])
          }
        } else if (scans.length > 0) {
          setSelectedScan(scans[0])
        }
      }
    } catch (error) {
      console.error('Failed to load scan history:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportReport = async () => {
    if (!selectedScan || !window.electronAPI?.report) return
    
    setExporting(true)
    try {
      await window.electronAPI.report.export({ scan: selectedScan, format: 'html' })
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setExporting(false)
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
      <aside className="w-72 border-r border-border bg-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Scan History ({scanHistory.length})
          </h3>
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
                  onClick={() => setSelectedScan(scan)}
                  className={`w-full text-left p-3 border-b border-border transition-colors ${
                    isSelected 
                      ? 'bg-primary/10 border-l-2 border-l-primary' 
                      : 'hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm font-semibold truncate">
                        {scan.target}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground font-mono">
                        <Calendar className="w-3 h-3" />
                        {new Date(scan.timestamp).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-mono ${getGradeColor(scan.securityScore?.grade)}`}>
                          {scan.securityScore?.grade || '—'}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {vulnCount} vuln{vulnCount !== 1 ? 's' : ''}
                        </span>
                        {criticalCount > 0 && (
                          <span className="text-[10px] text-[oklch(0.55_0.22_25)] font-mono">
                            {criticalCount}C
                          </span>
                        )}
                        {highCount > 0 && (
                          <span className="text-[10px] text-[oklch(0.65_0.25_45)] font-mono">
                            {highCount}H
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && <ChevronRight className="w-4 h-4 text-primary flex-shrink-0" />}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-xs text-muted-foreground text-center font-mono">
              No scans available
            </p>
          </div>
        )}
      </aside>

      {/* Main Content - Report View */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedScan ? (
          <>
            {/* Report Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="font-mono font-semibold">{selectedScan.target}</h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    {new Date(selectedScan.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={handleExportReport}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 border border-border hover:border-primary 
                         hover:text-primary transition-colors font-mono text-xs uppercase tracking-wider
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                Export HTML
              </button>
            </div>

            {/* Report Content */}
            <div className="flex-1 overflow-auto">
              <ReportViewer scan={selectedScan} />
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Scans Available</h3>
              <p className="text-muted-foreground text-sm font-mono mb-6">
                Run a scan from the Scan Target page to generate security reports.
              </p>
              <Link
                to="/scan"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground 
                           font-mono uppercase tracking-wider border border-primary hover:bg-primary/90 transition-colors"
              >
                Start Scanning <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
