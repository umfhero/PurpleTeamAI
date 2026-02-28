import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Target, Search, Shield, Zap, ChevronDown, ChevronRight, FileText, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { NmapScanData, VulnerabilityResult } from '../types/electron.d'
import type { TargetGroup, ScanDeltaChain } from '../types/delta'
import SecurityScoreCard from '../components/SecurityScoreCard'
import OWASPCoverageMatrix from '../components/OWASPCoverageMatrix'
import HallucinationMetricsPanel from '../components/HallucinationMetricsPanel'
import NotificationBadge from '../components/NotificationBadge'
import { useResizablePanel } from '../lib/useResizablePanel'

type SortField = 'severity' | 'port' | 'service' | 'cve'
type SortOrder = 'asc' | 'desc'

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }

const getSeverityBg = (severity: string) => {
    switch (severity) {
        case 'critical': return 'bg-[oklch(0.55_0.22_25)]'
        case 'high': return 'bg-[oklch(0.65_0.25_45)]'
        case 'medium': return 'bg-[oklch(0.70_0.15_85)]'
        case 'low': return 'bg-[oklch(0.55_0.15_150)]'
        default: return 'bg-[oklch(0.60_0.015_80)]'
    }
}

function gradeColor(grade?: string): string {
    if (!grade) return 'text-muted-foreground'
    if (grade === 'A+' || grade === 'A') return 'text-[oklch(0.55_0.15_150)]'
    if (grade === 'B') return 'text-[oklch(0.70_0.15_85)]'
    if (grade === 'C') return 'text-[oklch(0.65_0.25_45)]'
    return 'text-[oklch(0.55_0.22_25)]'
}

// Generate a detailed CVE explanation
const getCVEExplanation = (vuln: VulnerabilityResult): string | null => {
    if (!vuln.cve) return null

    // Pattern: "According to {CVE}, {service/software} is vulnerable to {attack type}."
    const attackTypes: Record<string, string> = {
        'path traversal': 'Path Traversal and potential Remote Code Execution attacks',
        'traversal': 'Path Traversal attacks allowing unauthorized file access',
        'memory': 'memory disclosure attacks that could expose sensitive data',
        'buffer': 'buffer overflow attacks that could lead to code execution',
        'injection': 'injection attacks that could compromise the system',
        'xss': 'Cross-Site Scripting (XSS) attacks',
        'sql': 'SQL Injection attacks',
        'rce': 'Remote Code Execution attacks',
        'dos': 'Denial of Service attacks',
        'overflow': 'buffer overflow attacks',
        'default': 'security vulnerabilities that could be exploited by attackers'
    }

    const descLower = vuln.description.toLowerCase()
    let attackType = attackTypes.default

    for (const [keyword, attack] of Object.entries(attackTypes)) {
        if (keyword !== 'default' && descLower.includes(keyword)) {
            attackType = attack
            break
        }
    }

    const service = vuln.service || 'the target service'
    return `According to ${vuln.cve}, ${service} is vulnerable to ${attackType}.`
}

// Get scan stats for a scan
const getScanStats = (scan: NmapScanData) => {
    const critical = scan.vulnerabilities.filter(v => v.severity === 'critical').length
    const high = scan.vulnerabilities.filter(v => v.severity === 'high').length
    const medium = scan.vulnerabilities.filter(v => v.severity === 'medium').length
    const low = scan.vulnerabilities.filter(v => v.severity === 'low').length
    const openPorts = scan.ports.filter(p => p.state === 'open')
    const portDetails = openPorts.map(p => `${p.port}/${p.protocol} (${p.service || 'unknown'})`)
    return { critical, high, medium, low, total: scan.vulnerabilities.length, ports: openPorts.length, portDetails }
}

export default function Dashboard() {
    const navigate = useNavigate()
    const location = useLocation()
    const incomingTarget = (location.state as { target?: string } | null)?.target

    // ── state ──────────────────────────────────────────────────────────────
    const [targetGroups, setTargetGroups] = useState<TargetGroup[]>([])
    const [expandedTarget, setExpandedTarget] = useState<string | null>(null)
    const [selectedScan, setSelectedScan] = useState<NmapScanData | null>(null)
    const [deltaChain, setDeltaChain] = useState<ScanDeltaChain | null>(null)
    const [loadingDeltas, setLoadingDeltas] = useState(false)

    const [sortField, setSortField] = useState<SortField>('severity')
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(true)
    const [expandedOutputs, setExpandedOutputs] = useState<Set<string>>(new Set())
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; scan: NmapScanData } | null>(null)

    const sidebar = useResizablePanel('dashboard-sidebar', 260, 180, 400)
    const leftPanel = useResizablePanel('dashboard-left', 420, 280, 700)

    const toggleOutput = (vulnId: string) => {
        setExpandedOutputs(prev => {
            const next = new Set(prev)
            next.has(vulnId) ? next.delete(vulnId) : next.add(vulnId)
            return next
        })
    }

    // Close context menu on outside click
    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null)
        if (contextMenu) {
            document.addEventListener('click', handleClickOutside)
            return () => document.removeEventListener('click', handleClickOutside)
        }
    }, [contextMenu])

    // ── load grouped history ───────────────────────────────────────────────
    const loadGroups = useCallback(async () => {
        try {
            if (window.electronAPI?.scanner) {
                const groups = await window.electronAPI.scanner.getGroupedHistory()
                setTargetGroups(groups)

                if (groups.length > 0) {
                    // If navigated from scan page, open that target's group
                    const match = incomingTarget
                        ? groups.find(g => g.target === incomingTarget)
                        : null
                    const group = match ?? groups[0]
                    setExpandedTarget(group.target)
                    setSelectedScan(group.scans[0])
                    loadDeltaChain(group.target)
                }
            }
        } catch (error) {
            console.error('Failed to load grouped scan history:', error)
        } finally {
            setLoading(false)
        }
    }, [incomingTarget])

    useEffect(() => { loadGroups() }, [loadGroups])

    const loadDeltaChain = async (target: string) => {
        if (!window.electronAPI?.scanner) return
        setLoadingDeltas(true)
        try {
            const chain = await window.electronAPI.scanner.getDeltas(target)
            setDeltaChain(chain)
        } catch (err) {
            console.error('Failed to load deltas:', err)
        } finally {
            setLoadingDeltas(false)
        }
    }

    // ── group expand / scan select ─────────────────────────────────────────
    const handleGroupClick = (target: string) => {
        if (expandedTarget === target) {
            setExpandedTarget(null)
        } else {
            setExpandedTarget(target)
            const group = targetGroups.find(g => g.target === target)
            if (group) {
                setSelectedScan(group.scans[0])
                loadDeltaChain(target)
            }
        }
    }

    const handleScanClick = (scan: NmapScanData) => {
        setSelectedScan(scan)
    }

    const handleViewReport = () => {
        if (!selectedScan) return
        navigate('/reports', { state: { scanTimestamp: selectedScan.timestamp } })
    }

    // ── delete ─────────────────────────────────────────────────────────────
    const handleDeleteScan = async (scan: NmapScanData) => {
        if (!window.electronAPI?.scanner) return
        try {
            await window.electronAPI.scanner.deleteScan(scan.timestamp)
            setContextMenu(null)
            const groups = await window.electronAPI.scanner.getGroupedHistory()
            setTargetGroups(groups)

            if (selectedScan?.timestamp === scan.timestamp) {
                const group = groups.find(g => g.target === scan.target)
                if (group && group.scans.length > 0) {
                    setSelectedScan(group.scans[0])
                } else {
                    setSelectedScan(groups[0]?.scans[0] ?? null)
                    if (groups.length > 0) setExpandedTarget(groups[0].target)
                }
                const newTarget = groups.find(g => g.target === scan.target) ? scan.target : groups[0]?.target
                if (newTarget) loadDeltaChain(newTarget)
            }
        } catch (error) {
            console.error('Failed to delete scan:', error)
        }
    }

    // ── sort / filter ──────────────────────────────────────────────────────
    const handleSort = (field: SortField) => {
        if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        else { setSortField(field); setSortOrder('asc') }
    }
    void handleSort

    const getSortedVulnerabilities = () => {
        if (!selectedScan) return []
        const negativeIndicators = [
            "couldn't find", "could not find", "not found",
            "no vulnerabilities", "not vulnerable", "not affected",
            "doesn't seem to be vulnerable", "does not appear to be vulnerable",
            "no issues found", "no matches found", "no results",
        ]
        const filtered = selectedScan.vulnerabilities.filter(vuln => {
            const outputLower = (vuln.output || vuln.description || '').toLowerCase()
            const isNegative = negativeIndicators.some(phrase => outputLower.includes(phrase))
            if (isNegative && outputLower.length < 200) return false
            if (!searchTerm) return true
            const term = searchTerm.toLowerCase()
            return (
                vuln.title.toLowerCase().includes(term) ||
                vuln.description.toLowerCase().includes(term) ||
                vuln.cve?.toLowerCase().includes(term) ||
                vuln.service?.toLowerCase().includes(term)
            )
        })
        return filtered.sort((a, b) => {
            let aVal: string | number, bVal: string | number
            switch (sortField) {
                case 'severity': aVal = severityOrder[a.severity]; bVal = severityOrder[b.severity]; break
                case 'port': aVal = a.port || 0; bVal = b.port || 0; break
                case 'service': aVal = a.service || ''; bVal = b.service || ''; break
                case 'cve': aVal = a.cve || ''; bVal = b.cve || ''; break
            }
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
            return 0
        })
    }

    // ── loading / empty ────────────────────────────────────────────────────
    if (loading) {
        return <div className="flex items-center justify-center h-full text-muted-foreground font-mono">Loading scans...</div>
    }

    if (targetGroups.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground font-mono text-sm">No scans yet. Go to Scan to start.</p>
                </div>
            </div>
        )
    }

    const sortedVulns = getSortedVulnerabilities()
    const currentStats = selectedScan ? getScanStats(selectedScan) : null
    const selectedGroup = targetGroups.find(g => g.target === selectedScan?.target)

    return (
        <div className="flex h-full">
            {/* ── Sidebar ─────────────────────────────────────────────────── */}
            <aside className="flex flex-col border-r border-border bg-card shrink-0" style={{ width: sidebar.width }}>
                <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-foreground/70">Scan History</h3>
                    <button
                        onClick={handleViewReport}
                        disabled={!selectedScan}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted/50 
                                   transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="View Report"
                    >
                        <FileText className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto">
                    {targetGroups.map((group) => {
                        const isExpanded = expandedTarget === group.target
                        const latestScan = group.scans[0]

                        return (
                            <div key={group.target} className="border-b border-border">
                                {/* ── Group header ── */}
                                <button
                                    onClick={() => handleGroupClick(group.target)}
                                    className={`w-full text-left px-3 py-2.5 transition-colors font-mono
                                                flex items-start gap-1.5
                                                ${isExpanded ? 'bg-muted/40 text-foreground' : 'hover:bg-muted/20 text-muted-foreground hover:text-foreground'}`}
                                >
                                    <span className="mt-0.5 flex-shrink-0 text-muted-foreground">
                                        {isExpanded
                                            ? <ChevronDown className="w-3 h-3" />
                                            : <ChevronRight className="w-3 h-3" />}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-sm truncate flex-1">{group.target}</span>
                                            <NotificationBadge count={group.count} />
                                        </div>
                                        {latestScan && (
                                            <div className="text-xs mt-0.5 flex gap-1.5">
                                                <span className={gradeColor(group.latestGrade)}>{group.latestGrade ?? '—'}</span>
                                                <span className="text-foreground/40">·</span>
                                                <span className="text-foreground/60">{new Date(latestScan.timestamp).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                    </div>
                                </button>

                                {/* ── Expanded: individual scans ── */}
                                {isExpanded && (
                                    <div className="bg-muted/10">
                                        {group.scans.map((scan, idx) => {
                                            const stats = getScanStats(scan)
                                            const isSelected = selectedScan?.timestamp === scan.timestamp
                                            const scanLabel = idx === 0 ? 'Latest' : `Scan ${group.count - idx}`

                                            return (
                                                <button
                                                    key={scan.timestamp}
                                                    onClick={() => handleScanClick(scan)}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault()
                                                        setContextMenu({ x: e.clientX, y: e.clientY, scan })
                                                    }}
                                                    className={`w-full text-left pl-7 pr-3 py-2 border-b border-border/50 transition-colors font-mono text-xs
                                                        ${isSelected
                                                            ? 'bg-primary/10 text-foreground border-l-2 border-l-primary'
                                                            : 'hover:bg-muted/30 text-muted-foreground hover:text-foreground'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="text-xs text-foreground uppercase tracking-wide">{scanLabel}</span>
                                                        <span className={`text-xs font-bold ${gradeColor(scan.securityScore?.grade)}`}>
                                                            {scan.securityScore?.grade ?? '—'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-foreground/60 mt-0.5 truncate">
                                                        {new Date(scan.timestamp).toLocaleString()}
                                                    </div>
                                                    <div className="flex gap-1.5 mt-1 text-xs font-semibold">
                                                        {stats.critical > 0 && <span className="text-[oklch(0.55_0.22_25)]">C:{stats.critical}</span>}
                                                        {stats.high > 0 && <span className="text-[oklch(0.65_0.25_45)]">H:{stats.high}</span>}
                                                        {stats.medium > 0 && <span className="text-[oklch(0.70_0.15_85)]">M:{stats.medium}</span>}
                                                        {stats.low > 0 && <span className="text-[oklch(0.55_0.15_150)]">L:{stats.low}</span>}
                                                        <span className="text-foreground/50">P:{stats.ports}</span>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </aside>

            {/* Sidebar drag handle */}
            <div onMouseDown={sidebar.onMouseDown} className="w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors shrink-0" />

            {/* ── Main Content ─────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel: Score + OWASP + Scan Progression */}
                    <div className="flex flex-col border-r border-border overflow-y-auto overflow-x-hidden shrink-0" style={{ width: leftPanel.width }}>
                        {selectedScan?.securityScore && (
                            <div className="border-b border-border">
                                <SecurityScoreCard score={selectedScan.securityScore} />
                            </div>
                        )}

                        {selectedScan?.owaspCoverage && selectedScan?.owaspDistribution && (
                            <div className="flex-1 border-b border-border">
                                <OWASPCoverageMatrix
                                    coverage={selectedScan.owaspCoverage}
                                    distribution={selectedScan.owaspDistribution}
                                />
                            </div>
                        )}

                        {selectedScan?.llmAnalysis?.hallucinationReport && (
                            <div className="border-b border-border">
                                <HallucinationMetricsPanel selectedScanTimestamp={selectedScan?.timestamp} />
                            </div>
                        )}

                        {/* ── Scan Progression ── */}
                        {selectedGroup && selectedGroup.count > 1 && (
                            <div className="border-b border-border">
                                <div className="px-3 py-2 border-b border-border/60 flex items-center gap-2">
                                    <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                                    <h4 className="text-xs font-mono uppercase tracking-wider text-foreground/70">
                                        Scan Progression
                                    </h4>
                                    <span className="text-xs text-foreground/50 ml-auto">
                                        {selectedGroup.count} scans
                                    </span>
                                </div>

                                {loadingDeltas ? (
                                    <div className="px-3 py-3 text-xs font-mono text-foreground/60">
                                        Computing deltas...
                                    </div>
                                ) : deltaChain && deltaChain.deltas.length > 0 ? (
                                    <div className="divide-y divide-border/50">
                                        {[...deltaChain.deltas].reverse().map((delta) => {
                                            const olderIdx = selectedGroup.scans.findIndex(s => s.timestamp === delta.olderTimestamp)
                                            const newerIdx = selectedGroup.scans.findIndex(s => s.timestamp === delta.newerTimestamp)
                                            const olderLabel = olderIdx === 0 ? 'Latest' : `Scan ${selectedGroup.count - olderIdx}`
                                            const newerLabel = newerIdx === 0 ? 'Latest' : `Scan ${selectedGroup.count - newerIdx}`

                                            return (
                                                <div key={`${delta.olderTimestamp}-${delta.newerTimestamp}`}
                                                    className="px-3 py-2 font-mono text-xs">
                                                    <div className="flex items-center gap-1.5 text-foreground mb-0.5">
                                                        <span>{olderLabel}</span>
                                                        <span className="text-foreground/50">→</span>
                                                        <span>{newerLabel}</span>
                                                    </div>

                                                    {!delta.hasChanges ? (
                                                        <div className="flex items-center gap-1.5 text-foreground/50">
                                                            <Minus className="w-3 h-3" />
                                                            <span>No changes between these scans</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-3 flex-wrap">
                                                            <span className={`flex items-center gap-0.5 font-bold ${delta.scoreChange > 0
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
                                                            {delta.resolved.length > 0 && (
                                                                <span className="text-[oklch(0.55_0.15_150)]">
                                                                    {delta.resolved.length} resolved
                                                                </span>
                                                            )}
                                                            {delta.newVulns.length > 0 && (
                                                                <span className="text-[oklch(0.55_0.22_25)]">
                                                                    {delta.newVulns.length} new
                                                                </span>
                                                            )}
                                                            {delta.persisting.length > 0 && (
                                                                <span className="text-foreground/70">
                                                                    {delta.persisting.length} persisting
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="px-3 py-3 text-xs font-mono text-foreground/50">
                                        Need at least 2 scans to show progression.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Left/Right panel drag handle */}
                    <div onMouseDown={leftPanel.onMouseDown} className="w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors shrink-0" />

                    {/* Right Panel: Vulnerabilities List */}
                    <div className="flex-1 flex flex-col overflow-hidden min-w-[300px]">
                        {selectedScan && (
                            <div className="px-4 py-1.5 border-b border-border bg-muted/10 flex items-center gap-2 font-mono text-xs text-foreground/60">
                                <span className="truncate font-semibold text-foreground">{selectedScan.target}</span>
                                <span className="text-foreground/40">·</span>
                                <span>{new Date(selectedScan.timestamp).toLocaleString()}</span>
                            </div>
                        )}

                        {/* Search */}
                        <div className="px-4 py-2 border-b border-border">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search vulnerabilities..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-1.5 bg-input border border-border text-foreground font-mono text-xs
                                         placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        {/* Vulnerability List */}
                        <div className="flex-1 overflow-auto">
                            {sortedVulns.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground font-mono text-sm">
                                    {searchTerm ? 'No vulnerabilities match your search' : 'No vulnerabilities found'}
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {sortedVulns.map((vuln) => {
                                        const cveExplanation = getCVEExplanation(vuln)
                                        const analysis = selectedScan?.llmAnalysis?.analyses?.find(a => a.vulnerabilityId === vuln.id)
                                        const isOutputExpanded = expandedOutputs.has(vuln.id)

                                        return (
                                            <div key={vuln.id} className="p-4 hover:bg-muted/50">
                                                <div className="flex items-start gap-3">
                                                    <span className={`inline-block px-2 py-0.5 text-[10px] uppercase font-bold ${getSeverityBg(vuln.severity)} text-background`}>
                                                        {vuln.severity}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono font-semibold text-sm">{vuln.title}</span>
                                                            {vuln.cve && <span className="text-xs font-mono text-primary">{vuln.cve}</span>}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                                                            Port {vuln.port || '-'} • {vuln.service || 'Unknown service'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {cveExplanation && (
                                                    <div className="mt-2 text-xs font-mono text-primary/90 italic">{cveExplanation}</div>
                                                )}

                                                <div className="mt-2 text-xs font-mono text-foreground/80 line-clamp-2">{vuln.description}</div>

                                                {vuln.output && (
                                                    <div className="mt-3">
                                                        <button
                                                            onClick={() => toggleOutput(vuln.id)}
                                                            className="flex items-center gap-1 text-xs uppercase tracking-wider text-foreground/60 hover:text-foreground transition-colors"
                                                        >
                                                            {isOutputExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                            Raw Output
                                                        </button>
                                                        {isOutputExpanded && (
                                                            <pre className="mt-1 p-2 bg-input border border-border overflow-x-auto text-[10px] font-mono max-h-40 overflow-y-auto">
                                                                {vuln.output}
                                                            </pre>
                                                        )}
                                                    </div>
                                                )}

                                                {analysis && (
                                                    <div className="mt-4 pt-3 border-t border-border space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs uppercase tracking-wider text-primary font-semibold">AI Analysis</span>
                                                            <span className="text-xs text-foreground/60">({(analysis.confidenceScore * 100).toFixed(0)}% confidence)</span>
                                                        </div>
                                                        <p className="text-xs font-mono text-foreground/80">{analysis.plainEnglishSummary}</p>
                                                        {analysis.affectedEndpoints.length > 0 && (
                                                            <div>
                                                                <div className="text-xs uppercase tracking-wider text-foreground/70">Affected Endpoints</div>
                                                                <ul className="mt-1 text-xs font-mono list-disc list-inside text-foreground/80">
                                                                    {analysis.affectedEndpoints.map((endpoint, idx) => (
                                                                        <li key={idx}>{endpoint}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="text-xs uppercase tracking-wider text-foreground/70">Remediation</div>
                                                            <ol className="mt-1 text-xs font-mono list-decimal list-inside text-foreground/80 space-y-0.5">
                                                                {analysis.remediationSteps.map((step, idx) => (
                                                                    <li key={idx}>{step}</li>
                                                                ))}
                                                            </ol>
                                                        </div>
                                                        {analysis.owaspCategory && (
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <span className="text-foreground/70">OWASP:</span>
                                                                <span className="text-primary font-semibold">{analysis.owaspCategory}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats Bar */}
                {currentStats && (
                    <div className="px-4 py-2 flex flex-wrap gap-4 text-xs font-mono border-t border-border bg-card">
                        <div className="flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-primary" />
                            <span className="text-foreground/70">Vulns:</span>
                            <span className="font-semibold">{currentStats.total}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-[oklch(0.55_0.22_25)]" />
                            <span className="text-foreground/70">Critical:</span>
                            <span className="font-semibold text-[oklch(0.55_0.22_25)]">{currentStats.critical}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-[oklch(0.65_0.25_45)]" />
                            <span className="text-foreground/70">High:</span>
                            <span className="font-semibold text-[oklch(0.65_0.25_45)]">{currentStats.high}</span>
                        </div>
                        <div className="flex items-center gap-1.5 relative group cursor-help">
                            <Target className="w-3.5 h-3.5 text-foreground/60" />
                            <span className="text-foreground/70">Ports:</span>
                            <span className="font-semibold">{currentStats.ports}</span>
                            {currentStats.portDetails.length > 0 && (
                                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-card border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap">
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Open Ports</div>
                                    {currentStats.portDetails.map((port, i) => (
                                        <div key={i} className="text-xs text-foreground">{port}</div>
                                    ))}
                                </div>
                            )}
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

