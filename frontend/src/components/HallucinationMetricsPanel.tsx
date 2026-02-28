import { useState, useEffect } from 'react'
import { ShieldAlert, Eye, AlertTriangle, TrendingUp, Gauge } from 'lucide-react'
import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { HallucinationMetricsEntry, HallucinationMetricsAggregate } from '../types/electron.d'

interface HallucinationMetricsPanelProps {
  selectedScanTimestamp?: string
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

export default function HallucinationMetricsPanel({ selectedScanTimestamp }: HallucinationMetricsPanelProps) {
  const [history, setHistory] = useState<HallucinationMetricsEntry[]>([])
  const [aggregate, setAggregate] = useState<HallucinationMetricsAggregate | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!window.electronAPI?.hallucination) return
      try {
        const [hist, agg] = await Promise.all([
          window.electronAPI.hallucination.getMetricsHistory(),
          window.electronAPI.hallucination.getMetricsAggregate(),
        ])
        setHistory(hist)
        setAggregate(agg)
      } catch (err) {
        console.error('Failed to load hallucination metrics:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedScanTimestamp])

  if (loading || !aggregate || aggregate.totalScans === 0) return null

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
          Hallucination Metrics
        </h2>
        <span className="text-xs font-mono text-foreground/50 ml-auto">
          {aggregate.totalScans} scan{aggregate.totalScans !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* 2x2 Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* OWASP Disagreement */}
          <div className="border border-border p-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/60 flex items-center gap-1">
              <Eye className="w-3 h-3" /> OWASP Disagreement
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
            <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/60 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Fabricated CVEs
            </div>
            <div className={`text-lg font-mono font-bold ${aggregate.totalFabricatedCVEs > 0 ? 'text-[oklch(0.55_0.22_25)]' : 'text-[oklch(0.75_0.15_160)]'}`}>
              {aggregate.totalFabricatedCVEs}
            </div>
            <div className="text-[10px] font-mono text-foreground/50">
              in {aggregate.scansWithFabricatedCVEs} scan{aggregate.scansWithFabricatedCVEs !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Confidence Mismatch */}
          <div className="border border-border p-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/60 flex items-center gap-1">
              <Gauge className="w-3 h-3" /> Confidence Mismatch
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
            <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/60 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Mean Trust Score
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
        {chartData.length >= 2 && (
          <div className="border-t border-border pt-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/60 mb-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Trust Score Trend
            </div>
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
                    formatter={(value: number) => [`${value}/100`, 'Trust Score']}
                    labelFormatter={(_: string, payload: Array<{ payload?: { timestamp?: string } }>) => {
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
          </div>
        )}

        {/* Risk Distribution Bar */}
        {totalRisk > 0 && (
          <div className="border-t border-border pt-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/60 mb-1.5">
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
