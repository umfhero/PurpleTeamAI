import { useState } from 'react'
import { Crosshair, AlertTriangle, Check, Loader2 } from 'lucide-react'
import type { NmapScanData } from '../types/electron.d'

type ScanState = 'idle' | 'validating' | 'confirming' | 'scanning' | 'complete' | 'error'

export default function ScanTarget() {
  const [target, setTarget] = useState('')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [validationResult, setValidationResult] = useState<{ allowed: boolean; message: string } | null>(null)
  const [scanResult, setScanResult] = useState<NmapScanData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const validateTarget = async () => {
    if (!target.trim()) {
      setError('Please enter a target URL or IP')
      return
    }

    setScanState('validating')
    setError(null)

    try {
      // Check if we're in Electron environment
      if (window.electronAPI) {
        const result = await window.electronAPI.scanner.validateTarget(target)
        if (result.allowed) {
          setValidationResult({ allowed: true, message: `Target "${target}" is in the allowlist.` })
          setScanState('confirming')
        } else {
          setValidationResult({ allowed: false, message: `Target "${target}" is NOT in the allowlist. Scanning blocked.` })
          setScanState('error')
          setError('Target not allowed. Only authorized targets can be scanned.')
        }
      } else {
        // Development fallback - simulate validation
        const allowedPatterns = ['testphp.vulnweb.com', 'localhost', '127.0.0.1']
        const isAllowed = allowedPatterns.some(pattern => target.includes(pattern))
        if (isAllowed) {
          setValidationResult({ allowed: true, message: `Target "${target}" is in the allowlist.` })
          setScanState('confirming')
        } else {
          setValidationResult({ allowed: false, message: `Target "${target}" is NOT allowed.` })
          setScanState('error')
          setError('Target not allowed. Only authorized targets can be scanned.')
        }
      }
    } catch (err) {
      setError('Validation failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
      setScanState('error')
    }
  }

  const startScan = async () => {
    setScanState('scanning')
    setError(null)

    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.scanner.runNmap(target)
        if (result.success && result.data) {
          setScanResult(result.data)
          setScanState('complete')
        } else {
          setError(result.message || 'Scan failed')
          setScanState('error')
        }
      } else {
        // Development simulation
        await new Promise(resolve => setTimeout(resolve, 2000))
        setScanResult({
          target,
          timestamp: new Date().toISOString(),
          scanType: 'simulated',
          ports: [
            { port: 80, protocol: 'tcp', state: 'open', service: 'http', version: 'Apache/2.4.7' },
            { port: 443, protocol: 'tcp', state: 'open', service: 'https' },
          ],
          vulnerabilities: [
            {
              id: 'demo-1',
              title: 'SQL Injection Vulnerability',
              description: 'Simulated vulnerability for development',
              severity: 'high',
              port: 80,
              service: 'http',
            },
          ],
        })
        setScanState('complete')
      }
    } catch (err) {
      setError('Scan failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
      setScanState('error')
    }
  }

  const reset = () => {
    setTarget('')
    setScanState('idle')
    setValidationResult(null)
    setScanResult(null)
    setError(null)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="border border-border p-6 shadow-brutal bg-card">
        <h2 className="text-2xl mb-2">Target Scanner</h2>
        <p className="text-muted-foreground text-sm font-mono">
          Enter a target URL or IP address to initiate vulnerability scanning.
          Only allowlisted targets can be scanned.
        </p>
      </div>

      {/* Input Section */}
      <div className="border border-border p-6 shadow-brutal bg-card space-y-4">
        <label className="block">
          <span className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
            Target URL / IP
          </span>
          <div className="mt-2 flex gap-0">
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="testphp.vulnweb.com"
              disabled={scanState === 'scanning'}
              className="flex-1 px-4 py-3 bg-input border border-border text-foreground font-mono 
                         placeholder:text-muted-foreground focus:outline-none focus:border-primary
                         disabled:opacity-50"
            />
            <button
              onClick={validateTarget}
              disabled={scanState === 'scanning' || scanState === 'validating'}
              className="px-6 py-3 bg-primary text-primary-foreground font-mono uppercase tracking-wider
                         border border-primary hover:bg-primary/90 disabled:opacity-50
                         shadow-brutal-orange active:translate-x-1 active:translate-y-1 active:shadow-none
                         transition-transform"
            >
              {scanState === 'validating' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Validate'
              )}
            </button>
          </div>
        </label>

        {/* Allowlist hint */}
        <p className="text-xs text-muted-foreground font-mono">
          Allowed targets: testphp.vulnweb.com, localhost, 127.0.0.1
        </p>
      </div>

      {/* Validation Result */}
      {validationResult && (
        <div className={`border p-6 shadow-brutal ${
          validationResult.allowed 
            ? 'border-[hsl(var(--low))] bg-[hsl(var(--low))]/10' 
            : 'border-[hsl(var(--critical))] bg-[hsl(var(--critical))]/10'
        }`}>
          <div className="flex items-start gap-3">
            {validationResult.allowed ? (
              <Check className="w-5 h-5 text-[hsl(var(--low))] mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-[hsl(var(--critical))] mt-0.5" />
            )}
            <div>
              <p className="font-mono text-sm">{validationResult.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {scanState === 'confirming' && (
        <div className="border border-primary p-6 shadow-brutal-orange bg-card space-y-4">
          <div className="flex items-start gap-3">
            <Crosshair className="w-6 h-6 text-primary mt-0.5" />
            <div>
              <h3 className="text-lg mb-1">Confirm Scan</h3>
              <p className="text-muted-foreground text-sm font-mono">
                You are about to scan <span className="text-primary">{target}</span>.
                This will run Nmap with vulnerability detection scripts.
              </p>
            </div>
          </div>
          
          <div className="flex gap-4 pt-2">
            <button
              onClick={startScan}
              className="px-6 py-3 bg-primary text-primary-foreground font-mono uppercase tracking-wider
                         border border-primary hover:bg-primary/90
                         shadow-brutal-orange active:translate-x-1 active:translate-y-1 active:shadow-none
                         transition-transform"
            >
              Start Scan
            </button>
            <button
              onClick={reset}
              className="px-6 py-3 bg-card text-foreground font-mono uppercase tracking-wider
                         border border-border hover:bg-muted
                         shadow-brutal active:translate-x-1 active:translate-y-1 active:shadow-none
                         transition-transform"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Scanning Progress */}
      {scanState === 'scanning' && (
        <div className="border border-border p-6 shadow-brutal bg-card">
          <div className="flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <div>
              <p className="font-mono text-sm">Scanning {target}...</p>
              <p className="text-muted-foreground text-xs font-mono mt-1">
                Running: nmap -sV -sC --script vuln
              </p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4 h-1 bg-muted overflow-hidden">
            <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && scanState === 'error' && (
        <div className="border border-[hsl(var(--critical))] p-6 shadow-brutal bg-[hsl(var(--critical))]/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[hsl(var(--critical))] mt-0.5" />
            <div>
              <p className="font-mono text-sm text-[hsl(var(--critical))]">{error}</p>
              <button
                onClick={reset}
                className="mt-3 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scan Complete */}
      {scanState === 'complete' && scanResult && (
        <div className="border border-[hsl(var(--low))] p-6 shadow-brutal bg-[hsl(var(--low))]/10 space-y-4">
          <div className="flex items-start gap-3">
            <Check className="w-6 h-6 text-[hsl(var(--low))] mt-0.5" />
            <div>
              <h3 className="text-lg mb-1">Scan Complete</h3>
              <p className="text-muted-foreground text-sm font-mono">
                Results saved. View in the Results Dashboard.
              </p>
            </div>
          </div>
          
          <pre className="p-4 bg-background border border-border text-xs font-mono overflow-auto max-h-48">
            {JSON.stringify(scanResult, null, 2)}
          </pre>

          <button
            onClick={reset}
            className="px-6 py-3 bg-primary text-primary-foreground font-mono uppercase tracking-wider
                       border border-primary hover:bg-primary/90
                       shadow-brutal-orange active:translate-x-1 active:translate-y-1 active:shadow-none
                       transition-transform"
          >
            New Scan
          </button>
        </div>
      )}
    </div>
  )
}
