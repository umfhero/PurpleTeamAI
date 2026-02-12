import { useState, useEffect } from 'react'
import { AlertTriangle, Target, Search, Shield, Zap, ChevronDown, ChevronRight, FileText, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { NmapScanData, VulnerabilityResult } from '../types/electron.d'
import SecurityScoreCard from '../components/SecurityScoreCard'
import OWASPCoverageMatrix from '../components/OWASPCoverageMatrix'

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
    const [scanHistory, setScanHistory] = useState<NmapScanData[]>([])
    const [selectedScan, setSelectedScan] = useState<NmapScanData | null>(null)
    const [sortField, setSortField] = useState<SortField>('severity')
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(true)
    const [expandedOutputs, setExpandedOutputs] = useState<Set<string>>(new Set())
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; scan: NmapScanData } | null>(null)

    const toggleOutput = (vulnId: string) => {
        setExpandedOutputs(prev => {
            const next = new Set(prev)
            if (next.has(vulnId)) {
                next.delete(vulnId)
            } else {
                next.add(vulnId)
            }
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

    const handleViewReport = () => {
        if (!selectedScan) return
        // Navigate to Reports page with the selected scan timestamp
        navigate('/reports', { state: { scanTimestamp: selectedScan.timestamp } })
    }

    useEffect(() => {
        loadScanHistory()
    }, [])

    const loadScanHistory = async () => {
        try {
            if (window.electronAPI) {
                const scans = await window.electronAPI.scanner.getHistory()
                // Sort by security score (lower score = worse, should be first)
                const sortedScans = scans.sort((a, b) => {
                    const scoreA = a.securityScore?.overall ?? 0
                    const scoreB = b.securityScore?.overall ?? 0
                    return scoreA - scoreB // Ascending order (worst first)
                })
                setScanHistory(sortedScans)
                if (sortedScans.length > 0) {
                    setSelectedScan(sortedScans[0])
                }
            } else {
                // Development fallback with demo data
                const mockScan: NmapScanData = {
                    target: 'testphp.vulnweb.com',
                    timestamp: new Date().toISOString(),
                    scanType: 'nmap-vuln',
                    ports: [
                        { port: 80, protocol: 'tcp', state: 'open', service: 'http', version: 'Apache/2.4.49' },
                        { port: 443, protocol: 'tcp', state: 'open', service: 'https', version: 'Apache/2.4.49' },
                    ],
                    vulnerabilities: [
                        {
                            id: 'demo-1',
                            cve: 'CVE-2021-41773',
                            title: 'Apache Path Traversal',
                            description: 'Path traversal vulnerability in Apache HTTP Server 2.4.49-2.4.50 allows attackers to access files outside the document root',
                            severity: 'critical',
                            port: 80,
                            service: 'Apache HTTP Server 2.4.49',
                        },
                        {
                            id: 'demo-2',
                            cve: 'CVE-2017-9798',
                            title: 'Apache Optionsbleed',
                            description: 'Memory leak in Apache HTTP Server allows remote attackers to read portions of memory via crafted OPTIONS requests',
                            severity: 'high',
                            port: 80,
                            service: 'Apache HTTP Server',
                        },
                        {
                            id: 'demo-3',
                            title: 'SSL Certificate Issue',
                            description: 'The SSL certificate configuration may allow weaker cipher suites',
                            severity: 'medium',
                            port: 443,
                            service: 'https',
                        },
                    ],
                }
                setScanHistory([mockScan])
                setSelectedScan(mockScan)
            }
        } catch (error) {
            console.error('Failed to load scan history:', error)
        } finally {
            setLoading(false)
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

            // Update local state
            const updatedScans = scanHistory.filter(s => s.timestamp !== scan.timestamp)
            setScanHistory(updatedScans)

            // If deleted scan was selected, select another one
            if (selectedScan?.timestamp === scan.timestamp) {
                setSelectedScan(updatedScans.length > 0 ? updatedScans[0] : null)
            }

            setContextMenu(null)
        } catch (error) {
            console.error('Failed to delete scan:', error)
        }
    }

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }

    const getSortedVulnerabilities = () => {
        if (!selectedScan) return []

        const filtered = selectedScan.vulnerabilities.filter(vuln => {
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
                case 'severity':
                    aVal = severityOrder[a.severity]
                    bVal = severityOrder[b.severity]
                    break
                case 'port':
                    aVal = a.port || 0
                    bVal = b.port || 0
                    break
                case 'service':
                    aVal = a.service || ''
                    bVal = b.service || ''
                    break
                case 'cve':
                    aVal = a.cve || ''
                    bVal = b.cve || ''
                    break
            }

            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
            return 0
        })
    }

    // Suppress unused variable warning
    void handleSort

    if (loading) {
        return <div className="flex items-center justify-center h-full text-muted-foreground font-mono">Loading scans...</div>
    }

    if (scanHistory.length === 0) {
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

    return (
        <div className="flex h-full">
            {/* Scan History Sidebar - flush to edge */}
            <aside className="w-56 flex flex-col border-r border-border bg-card">
                <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Scan History</h3>
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
                    {scanHistory.map((scan) => {
                        const stats = getScanStats(scan)
                        return (
                            <button
                                key={scan.timestamp}
                                onClick={() => setSelectedScan(scan)}
                                onContextMenu={(e) => handleContextMenu(e, scan)}
                                className={`w-full text-left px-3 py-2 border-b border-border transition-colors font-mono text-xs ${selectedScan?.timestamp === scan.timestamp
                                        ? 'bg-primary/10 text-foreground'
                                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <div className="font-semibold truncate text-sm">{scan.target}</div>
                                <div className="text-[10px] mt-0.5 opacity-60">{new Date(scan.timestamp).toLocaleString()}</div>
                                {/* Compact stats row */}
                                <div className="flex gap-2 mt-1 text-[10px]">
                                    {stats.critical > 0 && (
                                        <span className="text-[oklch(0.55_0.22_25)]">C:{stats.critical}</span>
                                    )}
                                    {stats.high > 0 && (
                                        <span className="text-[oklch(0.65_0.25_45)]">H:{stats.high}</span>
                                    )}
                                    {stats.medium > 0 && (
                                        <span className="text-[oklch(0.70_0.15_85)]">M:{stats.medium}</span>
                                    )}
                                    {stats.low > 0 && (
                                        <span className="text-[oklch(0.55_0.15_150)]">L:{stats.low}</span>
                                    )}
                                    <span className="text-muted-foreground">P:{stats.ports}</span>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </aside>

            {/* Main Content - Split: Left (Score+OWASP) | Right (Vulns) */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel: Security Score + OWASP - flexible width */}
                    <div className="flex-1 flex flex-col border-r border-border overflow-y-auto overflow-x-hidden min-w-[300px] max-w-[50%]">
                        {/* Security Score */}
                        {selectedScan?.securityScore && (
                            <div className="border-b border-border">
                                <SecurityScoreCard score={selectedScan.securityScore} />
                            </div>
                        )}

                        {/* OWASP Coverage */}
                        {selectedScan?.owaspCoverage && selectedScan?.owaspDistribution && (
                            <div className="flex-1 border-b border-border">
                                <OWASPCoverageMatrix
                                    coverage={selectedScan.owaspCoverage}
                                    distribution={selectedScan.owaspDistribution}
                                />
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Vulnerabilities List */}
                    <div className="flex-1 flex flex-col overflow-hidden min-w-[300px]">
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
                                                {/* Header Row */}
                                                <div className="flex items-start gap-3">
                                                    <span className={`inline-block px-2 py-0.5 text-[10px] uppercase font-bold ${getSeverityBg(vuln.severity)} text-background`}>
                                                        {vuln.severity}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono font-semibold text-sm">{vuln.title}</span>
                                                            {vuln.cve && (
                                                                <span className="text-xs font-mono text-primary">{vuln.cve}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                                                            Port {vuln.port || '-'} • {vuln.service || 'Unknown service'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* CVE Explanation - prominent at glance */}
                                                {cveExplanation && (
                                                    <div className="mt-2 text-xs font-mono text-primary/90 italic">
                                                        {cveExplanation}
                                                    </div>
                                                )}

                                                {/* Description - shorter line */}
                                                <div className="mt-2 text-xs font-mono text-foreground/70 line-clamp-2">
                                                    {vuln.description}
                                                </div>

                                                {/* Collapsible Raw Output */}
                                                {vuln.output && (
                                                    <div className="mt-3">
                                                        <button
                                                            onClick={() => toggleOutput(vuln.id)}
                                                            className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                                                        >
                                                            {isOutputExpanded ? (
                                                                <ChevronDown className="w-3 h-3" />
                                                            ) : (
                                                                <ChevronRight className="w-3 h-3" />
                                                            )}
                                                            Raw Output
                                                        </button>
                                                        {isOutputExpanded && (
                                                            <pre className="mt-1 p-2 bg-input border border-border overflow-x-auto text-[10px] font-mono max-h-40 overflow-y-auto">
                                                                {vuln.output}
                                                            </pre>
                                                        )}
                                                    </div>
                                                )}

                                                {/* AI Analysis */}
                                                {analysis && (
                                                    <div className="mt-4 pt-3 border-t border-border space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">AI Analysis</span>
                                                            <span className="text-[10px] text-muted-foreground">({(analysis.confidenceScore * 100).toFixed(0)}% confidence)</span>
                                                        </div>

                                                        <p className="text-xs font-mono text-foreground/80">{analysis.plainEnglishSummary}</p>

                                                        {analysis.affectedEndpoints.length > 0 && (
                                                            <div>
                                                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Affected Endpoints</div>
                                                                <ul className="mt-1 text-xs font-mono list-disc list-inside text-foreground/70">
                                                                    {analysis.affectedEndpoints.map((endpoint, idx) => (
                                                                        <li key={idx}>{endpoint}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Remediation</div>
                                                            <ol className="mt-1 text-xs font-mono list-decimal list-inside text-foreground/70 space-y-0.5">
                                                                {analysis.remediationSteps.map((step, idx) => (
                                                                    <li key={idx}>{step}</li>
                                                                ))}
                                                            </ol>
                                                        </div>

                                                        {analysis.owaspCategory && (
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <span className="text-muted-foreground">OWASP:</span>
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

                {/* Stats Bar - Fixed to bottom */}
                {currentStats && (
                    <div className="px-4 py-2 flex flex-wrap gap-4 text-xs font-mono border-t border-border bg-card">
                        <div className="flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-primary" />
                            <span className="text-muted-foreground">Vulns:</span>
                            <span className="font-semibold">{currentStats.total}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-[oklch(0.55_0.22_25)]" />
                            <span className="text-muted-foreground">Critical:</span>
                            <span className="font-semibold text-[oklch(0.55_0.22_25)]">{currentStats.critical}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-[oklch(0.65_0.25_45)]" />
                            <span className="text-muted-foreground">High:</span>
                            <span className="font-semibold text-[oklch(0.65_0.25_45)]">{currentStats.high}</span>
                        </div>
                        <div className="flex items-center gap-1.5 relative group cursor-help">
                            <Target className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Ports:</span>
                            <span className="font-semibold">{currentStats.ports}</span>
                            {/* Port details tooltip */}
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
                        Delete Scan
                    </button>
                </div>
            )}
        </div>
    )
}
