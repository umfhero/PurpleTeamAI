import { useState, useEffect } from 'react'
import { ShieldAlert, Eye, AlertTriangle, TrendingUp, Gauge } from 'lucide-react'
import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { HallucinationMetricsEntry, HallucinationMetricsAggregate } from '../types/electron.d'

interface HallucinationMetricsPanelProps {
  selectedScanTimestamp?: string
  target?: string  // Filter metrics by target URL
}

function rateColor(rate: number): string {
  if (rate <= 0.10) return 'text-[oklch(0.75_0.15_160)]'
  if (rate <= 0.25) return 'text-[oklch(0.70_0.15_85)]'
  return 'text-[oklch(0.55_0.22_25)]'
}

function trustColor(score: number): string {
  if (score >= 90) return 'text-primary'
  if (score >= 70) return 'text-[oklch(0.75_0.15_160)]'
  if (score >= 50) return 'text-[oklch(0.70_0.15_85)]'
  return 'text-[oklch(0.55_0.22_25)]'
}

// Compute aggregate statistics from filtered metrics
function computeAggregate(entries: HallucinationMetricsEntry[]): HallucinationMetricsAggregate {
  const totalScans = entries.length
  const totalOwaspDisagreements = entries.reduce((sum, e) => sum + e.owaspDisagreementCount, 0)
  const totalConfidenceMismatches = entries.reduce((sum, e) => sum + e.confidenceMismatchCount, 0)
  const totalVulnsAnalysed = entries.reduce((sum, e) => sum + e.totalAnalysed, 0)
  const allFabricatedCVEs = [...new Set(entries.flatMap(e => e.fabricatedCVEs))]
  const scansWithFabricatedCVEs = entries.filter(e => e.fabricatedCVECount > 0).length
  
  const trustScores = entries.map(e => e.trustScore)
  const meanTrustScore = trustScores.reduce((sum, s) => sum + s, 0) / totalScans
  const minTrustScore = Math.min(...trustScores)
  const maxTrustScore = Math.max(...trustScores)
  
  const trustDist = {
    excellent: trustScores.filter(s => s >= 90 && s <= 100).length,
    good: trustScores.filter(s => s >= 70 && s < 90).length,
    moderate: trustScores.filter(s => s >= 50 && s < 70).length,
    poor: trustScores.filter(s => s < 50).length,
  }
  
  return {
    totalScans,
    meanOwaspDisagreementRate: totalVulnsAnalysed > 0 ? totalOwaspDisagreements / totalVulnsAnalysed : 0,
    totalOwaspDisagreements,
    totalFabricatedCVEs: allFabricatedCVEs.length,
    allFabricatedCVEs,
    scansWithFabricatedCVEs,
    meanConfidenceMismatchRate: totalVulnsAnalysed > 0 ? totalConfidenceMismatches / totalVulnsAnalysed : 0,
    totalConfidenceMismatches,
    meanTrustScore,
    minTrustScore,
    maxTrustScore,
    trustScoreDistribution: trustDist,
    totalLowRisk: entries.reduce((sum, e) => sum + e.lowRisk, 0),
    totalMediumRisk: entries.reduce((sum, e) => sum + e.mediumRisk, 0),
    totalHighRisk: entries.reduce((sum, e) => sum + e.highRisk, 0),
    totalVulnsAnalysed,
  }
}

export default function HallucinationMetricsPanel({ selectedScanTimestamp, target }: HallucinationMetricsPanelProps) {
  const [history, setHistory] = useState<HallucinationMetricsEntry[]>([])
  const [aggregate, setAggregate] = useState<HallucinationMetricsAggregate | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!window.electronAPI?.hallucination) return
      try {
        const hist = await window.electronAPI.hallucination.getMetricsHistory()
        
        // Filter by target if specified
        const filteredHist = target 
          ? hist.filter(entry => entry.target === target || entry.target.includes(target.replace(/^https?:\/\//, '')))
          : hist
        
        setHistory(filteredHist)
        
        // Compute aggregate from filtered data
        if (filteredHist.length > 0) {
          const agg = computeAggregate(filteredHist)
          setAggregate(agg)
        } else {
          setAggregate(null)
        }
      } catch (err) {
        console.error('Failed to load hallucination metrics:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedScanTimestamp, target])

  if (loading || !aggregate || history.length === 0) return null

  const chartData = history
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .map((entry, idx) => ({
      name: `Scan ${idx + 1}`,
      trustScore: entry.trustScore,
      timestamp: entry.recordedAt,
    }))

  const totalRisk = aggregate.totalLowRisk + aggregate.totalMediumRisk + aggregate.totalHighRisk
  const lowPct = totalRisk > 0 ? (aggregate.totalLowRisk / totalRisk) * 100 : 0
  const medPct = totalRisk > 0 ? (aggregate.totalMediumRisk / totalRisk) * 100 : 0
  const highPct = totalRisk > 0 ? (aggregate.totalHighRisk / totalRisk) * 100 : 0

  return (
    <div className="border border-border bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-3 py-2 flex items-center gap-2">
        <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
        <h2 className="text-sm font-mono uppercase tracking-wider text-foreground/80">
          Hallucination Metrics {target && `— ${target.replace(/^https?:\/\//, '').split('/')[0]}`}
        </h2>
        <span className="text-xs font-mono text-foreground/50 ml-auto">
          {history.length} scan{history.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* 2x2 Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* OWASP Disagreement */}
          <div className="border border-border p-2">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-foreground/90 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> OWASP Disagreement
            </div>
            <div className={`text-lg font-mono font-bold ${rateColor(aggregate.meanOwaspDisagreementRate)}`}>
              {(aggregate.meanOwaspDisagreementRate * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] font-mono text-foreground/50">
              {aggregate.totalOwaspDisagreements} across {aggregate.totalScans} scans
            </div>
          </div>

          {/* Fabricated CVEs */}
          <div className="border border-border p-2">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-foreground/90 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Fabricated CVEs
            </div>
            <div className={`text-lg font-mono font-bold ${aggregate.totalFabricatedCVEs > 0 ? 'text-[oklch(0.55_0.22_25)]' : 'text-[oklch(0.75_0.15_160)]'}`}>
              {aggregate.totalFabricatedCVEs}
            </div>
            <div className="text-[10px] font-mono text-foreground/50">
              across {aggregate.totalScans} scan{aggregate.totalScans !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Confidence Mismatch */}
          <div className="border border-border p-2">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-foreground/90 flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5" /> Confidence Mismatch
            </div>
            <div className={`text-lg font-mono font-bold ${rateColor(aggregate.meanConfidenceMismatchRate)}`}>
              {(aggregate.meanConfidenceMismatchRate * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] font-mono text-foreground/50">
              {aggregate.totalConfidenceMismatches} of {aggregate.totalVulnsAnalysed} vulns
            </div>
          </div>

          {/* Mean Trust Score */}
          <div className="border border-border p-2">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-foreground/90 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Mean Trust Score
            </div>
            <div className={`text-lg font-mono font-bold ${trustColor(aggregate.meanTrustScore)}`}>
              {aggregate.meanTrustScore.toFixed(1)}
            </div>
            <div className="text-[10px] font-mono text-foreground/50">
              min {aggregate.minTrustScore} / max {aggregate.maxTrustScore}
            </div>
          </div>
        </div>

        {/* Trust Score Trend */}
        {chartData.length >= 1 && (
          <div className="border-t border-border pt-3">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-foreground/90 mb-2 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Trust Score {chartData.length > 1 ? 'Over Time' : ''}
            </div>
            <div className="text-[11px] font-mono text-foreground/70 mb-2 leading-relaxed">
              <strong>What it measures:</strong> Agreement between AI analysis and keyword validators. Low scores mean "validation caught differences - review manually." High scores mean "AI and validators agree."
            </div>
            <div className="text-[10px] font-mono text-foreground/50 mb-2">
              Formula: 100 - (fabricated CVEs × 50) - (OWASP disagreements × 5) - (confidence mismatches × 3)
            </div>
            {chartData.length === 1 ? (
              <div className="text-center py-4 text-xs font-mono text-foreground/60">
                Single scan: {chartData[0].trustScore}/100
                <div className="text-[10px] text-foreground/50 mt-1">Run more scans to see trend</div>
              </div>
            ) : (
              <div style={{ height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="trustGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.60 0.20 300)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="oklch(0.60 0.20 300)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: 0,
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: '#e0e0e0',
                      }}
                      formatter={(value) => {
                        const displayValue = Array.isArray(value) ? value[0] : value
                        return [`${displayValue}/100`, 'Trust Score']
                      }}
                      labelFormatter={(_: unknown, payload: ReadonlyArray<{ payload?: { timestamp?: string } }>) => {
                        if (payload?.[0]?.payload?.timestamp) {
                          return new Date(payload[0].payload.timestamp).toLocaleDateString()
                        }
                        return ''
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="trustScore"
                      stroke="oklch(0.60 0.20 300)"
                      fill="url(#trustGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Risk Distribution Bar */}
        {totalRisk > 0 && (
          <div className="border-t border-border pt-3">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-foreground/90 mb-1.5">
              Risk Distribution
            </div>
            <div className="flex h-4 w-full overflow-hidden border border-border">
              {lowPct > 0 && (
                <div
                  className="bg-[oklch(0.55_0.15_150)] h-full"
                  style={{ width: `${lowPct}%` }}
                  title={`Low: ${aggregate.totalLowRisk}`}
                />
              )}
              {medPct > 0 && (
                <div
                  className="bg-[oklch(0.70_0.15_85)] h-full"
                  style={{ width: `${medPct}%` }}
                  title={`Medium: ${aggregate.totalMediumRisk}`}
                />
              )}
              {highPct > 0 && (
                <div
                  className="bg-[oklch(0.55_0.22_25)] h-full"
                  style={{ width: `${highPct}%` }}
                  title={`High: ${aggregate.totalHighRisk}`}
                />
              )}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] font-mono text-[oklch(0.55_0.15_150)]">
                {aggregate.totalLowRisk} low
              </span>
              <span className="text-[10px] font-mono text-[oklch(0.70_0.15_85)]">
                {aggregate.totalMediumRisk} med
              </span>
              <span className="text-[10px] font-mono text-[oklch(0.55_0.22_25)]">
                {aggregate.totalHighRisk} high
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
