import { useState, useEffect } from 'react'
import { FileText, FileDown, ArrowRight, ExternalLink, Trash2, Loader2, AlertTriangle, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReportMetadata } from '../types/electron.d'

// Get grade color
function getGradeColor(grade?: string): string {
  if (!grade) return 'text-muted-foreground'
  if (grade === 'A+' || grade === 'A') return 'text-[oklch(0.55_0.15_150)]'
  if (grade === 'B') return 'text-[oklch(0.70_0.15_85)]'
  if (grade === 'C') return 'text-[oklch(0.65_0.25_45)]'
  return 'text-[oklch(0.55_0.22_25)]'
}

export default function Reports() {
  const [reports, setReports] = useState<ReportMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    try {
      if (window.electronAPI?.report) {
        const history = await window.electronAPI.report.getHistory()
        setReports(history)
      }
    } catch (error) {
      console.error('Failed to load reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenReport = async (id: string) => {
    if (window.electronAPI?.report) {
      await window.electronAPI.report.open(id)
    }
  }

  const handleDeleteReport = async (id: string) => {
    if (!window.electronAPI?.report) return
    
    setDeleting(id)
    try {
      const success = await window.electronAPI.report.delete(id, false)
      if (success) {
        setReports(prev => prev.filter(r => r.id !== id))
      }
    } finally {
      setDeleting(null)
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
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Report List */}
        {reports.length > 0 ? (
          <div className="flex-1 overflow-auto">
            <div className="p-4 border-b border-border bg-muted/20">
              <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                Exported Reports ({reports.length})
              </h3>
            </div>
            <div className="divide-y divide-border">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-mono font-semibold truncate">
                            {report.target}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">
                            Exported {new Date(report.exportedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      
                      {/* Stats Row */}
                      <div className="flex items-center gap-4 mt-3 text-xs font-mono">
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-primary" />
                          <span className={getGradeColor(report.grade)}>
                            {report.grade || '—'}{report.securityScore !== undefined ? ` (${report.securityScore}%)` : ''}
                          </span>
                        </div>
                        <span className="text-muted-foreground">
                          {report.vulnerabilityCount} vulnerabilities
                        </span>
                        <span className="text-muted-foreground">
                          {report.format.toUpperCase()}
                        </span>
                      </div>
                      
                      {/* File Path */}
                      <div className="text-[10px] text-muted-foreground/60 font-mono mt-2 truncate">
                        {report.filePath}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleOpenReport(report.id)}
                        className="p-2 border border-border hover:border-primary hover:text-primary transition-colors"
                        title="Open Report"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteReport(report.id)}
                        disabled={deleting === report.id}
                        className="p-2 border border-border hover:border-[hsl(var(--critical))] hover:text-[hsl(var(--critical))] transition-colors disabled:opacity-50"
                        title="Remove from history"
                      >
                        {deleting === report.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Reports Yet</h3>
              <p className="text-muted-foreground text-sm font-mono mb-6">
                Export a security report from the Results Dashboard to see it here.
              </p>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground 
                           font-mono uppercase tracking-wider border border-primary hover:bg-primary/90 transition-colors"
              >
                Go to Results <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar - How to Export */}
      <aside className="w-72 border-l border-border bg-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            How to Export
          </h3>
        </div>
        <div className="flex-1 p-4 space-y-4 text-sm">
          <div className="flex gap-3">
            <div className="w-6 h-6 border border-primary/50 bg-primary/10 flex items-center justify-center text-primary font-mono text-xs font-bold flex-shrink-0">
              1
            </div>
            <div>
              <p className="font-semibold text-xs">Go to Results</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                View your scan history
              </p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="w-6 h-6 border border-primary/50 bg-primary/10 flex items-center justify-center text-primary font-mono text-xs font-bold flex-shrink-0">
              2
            </div>
            <div>
              <p className="font-semibold text-xs">Select Scan</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                Choose from sidebar
              </p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="w-6 h-6 border border-primary/50 bg-primary/10 flex items-center justify-center text-primary font-mono text-xs font-bold flex-shrink-0">
              3
            </div>
            <div>
              <p className="font-semibold text-xs">Click Export</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
                Use the <FileDown className="w-3 h-3 inline" /> button
              </p>
            </div>
          </div>
        </div>

        {/* Report Contents Info */}
        <div className="border-t border-border p-4">
          <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Report Includes</h4>
          <div className="space-y-1.5 text-xs font-mono text-muted-foreground">
            <div>• Executive Summary</div>
            <div>• Security Score & Grade</div>
            <div>• OWASP Coverage Matrix</div>
            <div>• Vulnerability Details</div>
            <div>• AI Remediation Steps</div>
          </div>
        </div>
      </aside>
    </div>
  )
}
