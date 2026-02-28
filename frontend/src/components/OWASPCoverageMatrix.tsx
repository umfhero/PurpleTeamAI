import type { OWASPCategory, OWASPCoverage } from '../types/electron.d'

interface OWASPCoverageMatrixProps {
  coverage: OWASPCoverage
  distribution: Record<OWASPCategory, number>
}

const OWASP_LABELS = {
  A01: { short: 'A01', name: 'Broken Access Control' },
  A02: { short: 'A02', name: 'Cryptographic Failures' },
  A03: { short: 'A03', name: 'Injection' },
  A04: { short: 'A04', name: 'Insecure Design' },
  A05: { short: 'A05', name: 'Security Misconfiguration' },
  A06: { short: 'A06', name: 'Vulnerable Components' },
  A07: { short: 'A07', name: 'Auth Failures' },
  A08: { short: 'A08', name: 'Data Integrity Failures' },
  A09: { short: 'A09', name: 'Logging Failures' },
  A10: { short: 'A10', name: 'SSRF' },
}

export default function OWASPCoverageMatrix({ coverage, distribution }: OWASPCoverageMatrixProps) {
  const categories = Object.keys(OWASP_LABELS) as OWASPCategory[]

  return (
    <div className="border border-border bg-background h-full flex flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-mono uppercase tracking-wider text-foreground/80">
            OWASP Top 10 Coverage
          </h2>
          <div className="text-sm font-mono">
            <span className="text-primary font-bold">{coverage.total}</span>
            <span className="text-foreground/60">/10</span>
            <span className="text-foreground/70 ml-2">({coverage.percentage}%)</span>
          </div>
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col">
        {/* Coverage grid */}
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {categories.map((cat) => {
            const count = distribution[cat] || 0
            const isFound = count > 0
            
            return (
              <div
                key={cat}
                className={`
                  border aspect-square flex flex-col items-center justify-center p-1
                  transition-all relative group cursor-default
                  ${isFound 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border/50 bg-background hover:border-border'
                  }
                `}
                title={OWASP_LABELS[cat].name}
              >
                {/* Category ID */}
                <div className={`text-xs font-mono font-bold ${isFound ? 'text-primary' : 'text-foreground/50'}`}>
                  {OWASP_LABELS[cat].short}
                </div>
                
                {/* Count if found */}
                {isFound && (
                  <div className="text-lg font-mono font-bold text-primary mt-0.5">
                    {count}
                  </div>
                )}

                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-xs font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-border">
                  {OWASP_LABELS[cat].name}
                  {isFound && `: ${count} vuln${count === 1 ? '' : 's'}`}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="border-t border-border pt-3 space-y-1.5 flex-1">
          {categories
            .filter(cat => distribution[cat] > 0)
            .sort((a, b) => distribution[b] - distribution[a])
            .map((cat) => (
              <div key={cat} className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 border border-primary bg-primary/10"></div>
                  <span className="text-foreground/70">{OWASP_LABELS[cat].short}</span>
                  <span className="text-foreground/90">{OWASP_LABELS[cat].name}</span>
                </div>
                <span className="text-primary font-bold">{distribution[cat]}</span>
              </div>
            ))}
          
          {coverage.total === 0 && (
            <div className="text-xs font-mono text-foreground/60 text-center py-2">
              No OWASP categories detected
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
