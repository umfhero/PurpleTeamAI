import type { SecurityScore } from '../types/electron.d'

interface SecurityScoreCardProps {
  score: SecurityScore
}

export default function SecurityScoreCard({ score }: SecurityScoreCardProps) {
  // Grade color (using primary/accent colors for good grades, warning/error for bad)
  const getGradeColor = () => {
    switch (score.grade) {
      case 'A+':
      case 'A':
        return 'text-primary' // light purple for excellent
      case 'B':
        return 'text-[oklch(0.75_0.15_160)]' // cyan for good
      case 'C':
        return 'text-[oklch(0.70_0.15_85)]' // orange for moderate
      case 'D':
        return 'text-[oklch(0.65_0.25_45)]' // orange-red for poor
      case 'F':
        return 'text-critical' // red for critical
      default:
        return 'text-foreground'
    }
  }

  const getGradeBg = () => {
    switch (score.grade) {
      case 'A+':
      case 'A':
        return 'bg-primary/10'
      case 'B':
        return 'bg-[oklch(0.75_0.15_160)]/10'
      case 'C':
        return 'bg-[oklch(0.70_0.15_85)]/10'
      case 'D':
        return 'bg-[oklch(0.65_0.25_45)]/10'
      case 'F':
        return 'bg-critical/10'
      default:
        return 'bg-background'
    }
  }

  const getConfidenceColor = () => {
    switch (score.confidence) {
      case 'high':
        return 'text-[oklch(0.45_0.15_160)] border-[oklch(0.45_0.15_160)]/30 font-bold'
      case 'medium':
        return 'text-[oklch(0.70_0.15_85)] border-[oklch(0.70_0.15_85)]/30'
      case 'low':
        return 'text-critical border-critical/30'
      default:
        return 'text-foreground/60 border-border'
    }
  }

  return (
    <div className="border border-border bg-background h-full flex flex-col">
      <div className="border-b border-border px-3 py-2">
        <h2 className="text-sm font-mono uppercase tracking-wider text-foreground/80">
          Security Score
        </h2>
      </div>

      <div className="p-3 flex-1 flex flex-col">
        {/* Large score display - grade on right */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-2">
            <div className={`text-5xl font-mono font-bold ${getGradeColor()}`}>
              {score.overall}
            </div>
            <div className="text-xl font-mono text-foreground/60">/100</div>
          </div>
          <div className={`text-4xl font-mono font-bold ${getGradeColor()} ${getGradeBg()} px-4 py-2 border border-current/20`}>
            {score.grade}
          </div>
        </div>

        {/* Confidence indicator */}
        {score.confidence && (
          <div className={`mb-3 px-2 py-1.5 border font-mono text-xs uppercase tracking-wider ${getConfidenceColor()}`}>
            <div className="flex items-center justify-between">
              <span>Scan Confidence: {score.confidence}</span>
              {score.confidence === 'low' && (
                <span className="text-critical font-bold">!</span>
              )}
            </div>
            {score.confidenceReason && (
              <div className="mt-1 text-xs normal-case tracking-normal text-foreground/70 leading-tight">
                {score.confidenceReason}
              </div>
            )}
          </div>
        )}

        {/* Score breakdown */}
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex justify-between items-center font-mono text-xs">
            <span className="text-foreground/80">Severity impact</span>
            <span className="text-critical">{score.breakdown.severityImpact}</span>
          </div>
          
          <div className="flex justify-between items-center font-mono text-xs">
            <span className="text-foreground/80">OWASP coverage penalty</span>
            <span className="text-high">{score.breakdown.owaspCoverage}</span>
          </div>
          
          {score.breakdown.remediationPotential > 0 && (
            <div className="flex justify-between items-center font-mono text-xs">
              <span className="text-foreground/80">Remediation bonus</span>
              <span className="text-primary">+{score.breakdown.remediationPotential}</span>
            </div>
          )}

          {/* Contextual weighting summary (Extension 4) */}
          {score.contextualWeightingEnabled && score.contextualWeighting && (
            <div className="mt-1 pt-2 border-t border-border/50 space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/50 mb-1">
                Contextual Weighting
              </div>
              <div className="flex justify-between items-center font-mono text-xs">
                <span className="text-foreground/70">Base deductions</span>
                <span className="text-foreground/60">−{score.contextualWeighting.totalBaseDeductions}</span>
              </div>
              <div className="flex justify-between items-center font-mono text-xs">
                <span className="text-foreground/70">Adjusted deductions</span>
                <span className="text-critical">−{score.contextualWeighting.totalAdjustedDeductions}</span>
              </div>
              {score.contextualWeighting.tlsPenaltyApplied && (
                <div className="flex justify-between items-center font-mono text-xs">
                  <span className="text-foreground/70">TLS absence penalty</span>
                  <span className="text-high">−8</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vulnerability counts */}
        <div className="border-t border-border mt-3 pt-3 space-y-1">
          <div className="grid grid-cols-2 gap-1 font-mono text-xs">
            {score.details.critical > 0 && (
              <div className="flex justify-between">
                <span className="text-foreground/80">Critical</span>
                <span className="text-critical">{score.details.critical}</span>
              </div>
            )}
            {score.details.high > 0 && (
              <div className="flex justify-between">
                <span className="text-foreground/80">High</span>
                <span className="text-high">{score.details.high}</span>
              </div>
            )}
            {score.details.medium > 0 && (
              <div className="flex justify-between">
                <span className="text-foreground/80">Medium</span>
                <span className="text-medium">{score.details.medium}</span>
              </div>
            )}
            {score.details.low > 0 && (
              <div className="flex justify-between">
                <span className="text-foreground/80">Low</span>
                <span className="text-low">{score.details.low}</span>
              </div>
            )}
          </div>
        </div>

        {/* Recommendations */}
        {score.recommendations.length > 0 && (
          <div className="border-t border-border mt-3 pt-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-foreground/80 mb-1">
              Recommendations
            </h3>
            <ul className="space-y-0.5">
              {score.recommendations.map((rec, i) => (
                <li key={i} className="text-xs font-mono text-foreground/90 pl-4 relative before:content-['→'] before:absolute before:left-0 before:text-primary">
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
