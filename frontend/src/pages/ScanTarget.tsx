import { useState, useEffect, useRef } from 'react'
import { Crosshair, AlertTriangle, Check, Loader2, ArrowRight, Brain, Zap, Circle, ChevronDown, ChevronUp, Square, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useScanStore } from '../lib/useScanStore'
import type { ScanState } from '../lib/scanStore'

// Progress step definitions
const MAX_RETRIES = 2 // Auto-retry up to 2 times on failure

const PROGRESS_STEPS = [
  { id: 'validating', label: 'Validating', description: 'Checking target' },
  { id: 'confirming', label: 'Confirm', description: 'Awaiting user action' },
  { id: 'scanning', label: 'Phase 1', description: 'Quick discovery' },
  { id: 'deepening', label: 'Phase 2', description: 'Deep vulnerability scan' },
  { id: 'analyzing', label: 'Analyzing', description: 'AI processing' },
  { id: 'complete', label: 'Complete', description: 'Results ready' },
] as const

// Progress Stepper Component
function ScanProgressStepper({ currentState, scanLogs }: { currentState: ScanState; scanLogs: string[] }) {
  const terminalRef = useRef<HTMLDivElement>(null)

  // Get the current step index
  const getCurrentStepIndex = () => {
    if (currentState === 'idle' || currentState === 'error') return -1
    if (currentState === 'retrying') return PROGRESS_STEPS.findIndex(step => step.id === 'scanning')
    return PROGRESS_STEPS.findIndex(step => step.id === currentState)
  }

  const currentIndex = getCurrentStepIndex()

  // Auto-scroll terminal to bottom when new logs appear
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [scanLogs])

  if (currentState === 'idle' || currentState === 'error') return null

  // Map 'retrying' to show the scanning step as active (retry feeds back into scanning)
  const displayState = currentState === 'retrying' ? 'scanning' : currentState

  return (
    <div className="border border-border bg-card animate-stagger-in">
      {/* Header */}
      <div className="border-b border-border p-4">
        <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Scan Progress</h3>
      </div>

      {/* Progress Steps */}
      <div>
        <div className="flex items-stretch justify-between gap-0">
          {PROGRESS_STEPS.map((step, index) => {
            const isActive = step.id === displayState
            const isComplete = currentIndex > index

            return (
              <div
                key={step.id}
                className="flex-1 transition-all duration-300"
              >
                {/* Step Item */}
                <div className={`border p-3 transition-colors h-full flex flex-col ${isActive
                  ? 'border-primary bg-primary/10'
                  : isComplete
                    ? 'border-[hsl(var(--low))] bg-[hsl(var(--low))]/10'
                    : 'border-border bg-muted/30'
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {isComplete ? (
                      <Check className="w-4 h-4 text-[hsl(var(--low))]" />
                    ) : isActive ? (
                      <Circle className="w-4 h-4 text-primary animate-progress-pulse" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className={`text-xs font-mono uppercase tracking-wider ${isActive ? 'text-primary' : isComplete ? 'text-[hsl(var(--low))]' : 'text-muted-foreground'
                      }`}>
                      {step.label}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground pl-6">
                    {step.description}
                  </p>
                </div>

                {/* Connector line */}
                {index < PROGRESS_STEPS.length - 1 && (
                  <div className="hidden" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Live Terminal - show during scanning, deepening, and analyzing */}
      {(currentState === 'scanning' || currentState === 'deepening' || currentState === 'analyzing' || currentState === 'retrying') && scanLogs.length > 0 && (
        <div className="border-t border-border">
          <div className="p-2 border-b border-border bg-muted/20 flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Live Output
            </span>
          </div>
          <div
            ref={terminalRef}
            className="bg-black p-3 font-mono text-[11px] text-white h-32 overflow-y-auto"
          >
            {scanLogs.slice(-20).map((line, i) => (
              <div
                key={i}
                className="whitespace-pre-wrap break-all animate-log-line"
                style={{ animationDelay: `${i * 20}ms` }}
              >
                <span className="text-green-400 mr-2">{'>'}</span>{line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ScanTarget() {
  const navigate = useNavigate()

  // Use global scan store for persistent state
  const {
    scanState,
    target,
    scanLogs,
    scanResult,
    error,
    setScanState,
    setTarget,
    setScanLogs,
    appendLog,
    setScanResult,
    setScanError,
    setProgressCleanup,
    setPhaseCleanup,
    reset,
  } = useScanStore()

  const [validationResult, setValidationResult] = useState<{ allowed: boolean; message: string; requiresDisclaimer: boolean } | null>(null)
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false)
  const [isInputCollapsed, setIsInputCollapsed] = useState(scanState === 'scanning' || scanState === 'deepening' || scanState === 'analyzing' || scanState === 'retrying')
  const [retryAttempt, setRetryAttempt] = useState(0)

  // Tab-autocomplete for known targets
  const KNOWN_TARGETS = [
    'testphp.vulnweb.com',
    'localhost',
    '127.0.0.1',
    '::1',
  ]

  const tabSuggestion = target.length > 0
    ? KNOWN_TARGETS.find(t => t.toLowerCase().startsWith(target.toLowerCase()) && t.toLowerCase() !== target.toLowerCase())
    : null

  const handleTabComplete = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && tabSuggestion) {
      e.preventDefault()
      setTarget(tabSuggestion)
    }
  }

  /**
   * Skip-scan shortcut: prefix target with "!" to skip Nmap and re-run
   * LLM analysis on the most recent scan for that target.
   * E.g. "!testphp.vulnweb.com" → loads last scan → LLM only.
   */
  const handleSkipScan = async (realTarget: string) => {
    setScanState('scanning')
    setScanError(null)
    setScanLogs([])
    setIsInputCollapsed(true)
    appendLog(`[Skip-Scan] Loading most recent scan for: ${realTarget}\n`)

    try {
      const history = await window.electronAPI!.scanner.getHistory()
      const matching = history
        .filter((s: any) => s.target === realTarget)
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      if (matching.length === 0) {
        setScanError(`No previous scan found for "${realTarget}". Run a full scan first.`)
        setScanState('error')
        return
      }

      // Prefer the most recent scan with the most vulnerabilities (skip incomplete Phase-1-only scans)
      const bestScan = matching.reduce((best: any, scan: any) =>
        (scan.vulnerabilities?.length ?? 0) > (best.vulnerabilities?.length ?? 0) ? scan : best
      , matching[0])
      const scanData = { ...bestScan } // Clone to avoid mutating history cache
      appendLog(`[Skip-Scan] Found scan from ${scanData.timestamp} with ${scanData.vulnerabilities?.length ?? 0} vulnerabilities\n`)
      setScanResult(scanData)
      setScanState('deepening')

      // Go straight to LLM analysis
      if (scanData.vulnerabilities && scanData.vulnerabilities.length > 0) {
        console.log(`[ScanTarget] Skip-scan: starting LLM analysis for ${scanData.vulnerabilities.length} vulnerabilities`)
        setScanState('analyzing')
        appendLog(`[LLM] Starting AI analysis for ${scanData.vulnerabilities.length} vulnerabilities...\n`)

        const llmResult = await window.electronAPI!.llm.analyzeVulnerabilities({
          vulnerabilities: scanData.vulnerabilities,
          target: scanData.target,
          scanTimestamp: scanData.timestamp,
        })

        if (llmResult.success) {
          scanData.llmAnalysis = llmResult
          appendLog(`[LLM] Analysis complete: ${llmResult.analyses.length} vulnerabilities analyzed\n`)
          try {
            await window.electronAPI!.scanner.saveScan(scanData)
            appendLog('[Skip-Scan] Saved enriched scan data\n')
          } catch (e) {
            console.warn('[ScanTarget] Failed to save:', e)
          }
        } else {
          appendLog(`[LLM] Analysis failed: ${llmResult.error}\n`)
        }
      } else {
        appendLog('[Skip-Scan] No vulnerabilities to analyze\n')
      }

      setScanResult({ ...scanData })
      setScanState('complete')
      appendLog('[Skip-Scan] Done\n')
    } catch (err) {
      console.error('[ScanTarget] Skip-scan error:', err)
      setScanError('Skip-scan failed: ' + (err instanceof Error ? err.message : String(err)))
      setScanState('error')
    }
  }

  const validateTarget = async () => {
    if (!target.trim()) {
      setScanError('Please enter a target URL or IP')
      return
    }

    // Skip-scan shortcut: "!target" skips Nmap, reuses last scan
    if (target.startsWith('!')) {
      const realTarget = target.slice(1).trim()
      if (!realTarget) {
        setScanError('Enter a target after "!" (e.g. !testphp.vulnweb.com)')
        return
      }
      return handleSkipScan(realTarget)
    }

    setScanState('validating')
    setScanError(null)
    setDisclaimerAccepted(false)

    try {
      // Check if we're in Electron environment
      if (window.electronAPI) {
        const result = await window.electronAPI.scanner.validateTarget(target)
        if (result.requiresDisclaimer) {
          setValidationResult({ allowed: true, message: `Target "${target}" requires legal acknowledgement before scanning.`, requiresDisclaimer: true })
          setScanState('confirming')
        } else {
          setValidationResult({ allowed: true, message: `Target "${target}" is a known safe testing target.`, requiresDisclaimer: false })
          setScanState('confirming')
        }
      } else {
        // Development fallback - simulate validation
        const knownSafePatterns = ['testphp.vulnweb.com', 'localhost', '127.0.0.1']
        const isKnownSafe = knownSafePatterns.some(pattern => target.includes(pattern))
        if (isKnownSafe) {
          setValidationResult({ allowed: true, message: `Target "${target}" is a known safe testing target.`, requiresDisclaimer: false })
        } else {
          setValidationResult({ allowed: true, message: `Target "${target}" requires legal acknowledgement before scanning.`, requiresDisclaimer: true })
        }
        setScanState('confirming')
      }
    } catch (err) {
      setScanError('Validation failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
      setScanState('error')
    }
  }

  /**
   * Run a single scan attempt. Returns { success, result, errorMessage }.
   */
  const runScanAttempt = async (): Promise<{ success: boolean; errorMessage?: string }> => {
    // Set up progress listener
    const removeListener = window.electronAPI!.scanner.onProgress((line: string) => {
      appendLog(line)
    })
    setProgressCleanup(removeListener)

    // Set up phase result listener — fires when Phase 1 completes
    const removePhaseListener = window.electronAPI!.scanner.onPhaseResult((data) => {
      console.log('[ScanTarget] Phase 1 complete, showing preliminary results')
      setScanResult(data)
      setScanState('deepening') // Transition to Phase 2
    })
    setPhaseCleanup(removePhaseListener)

    // Run progressive scan (Phase 1 + Phase 2 internally)
    console.log(`[ScanTarget] Starting progressive scan for: ${target}`)
    const result = await window.electronAPI!.scanner.runNmap({ target })

    // Clean up listeners
    removeListener()
    removePhaseListener()
    setProgressCleanup(null)
    setPhaseCleanup(null)

    console.log(`[ScanTarget] Scan result:`, result)

    if (result.success && result.data) {
      const scanData = result.data

      // Analyze with LLM if we have vulnerabilities
      if (scanData.vulnerabilities.length > 0) {
        console.log(`[ScanTarget] Starting LLM analysis for ${scanData.vulnerabilities.length} vulnerabilities`)
        setScanState('analyzing')
        appendLog('\n[LLM] Starting AI analysis...\n')

        try {
          const llmResult = await window.electronAPI!.llm.analyzeVulnerabilities({
            vulnerabilities: scanData.vulnerabilities,
            target: scanData.target,
            scanTimestamp: scanData.timestamp,
          })

          if (llmResult.success) {
            scanData.llmAnalysis = llmResult
            console.log(`[ScanTarget] LLM analysis complete: ${llmResult.analyses.length} analyses`)
            appendLog(`[LLM] Analysis complete: ${llmResult.analyses.length} vulnerabilities analyzed\n`)

            // Persist enriched scan data (with LLM analysis + hallucination report) back to disk
            try {
              await window.electronAPI!.scanner.saveScan(scanData)
              console.log('[ScanTarget] Saved enriched scan data to disk')
            } catch (saveErr) {
              console.warn('[ScanTarget] Failed to save scan data:', saveErr)
            }
          } else {
            console.warn('[ScanTarget] LLM analysis failed:', llmResult.error)
            appendLog(`[LLM] Analysis failed: ${llmResult.error}\n`)
          }
        } catch (llmError) {
          console.error('[ScanTarget] LLM analysis error:', llmError)
          appendLog(`[LLM] Error: ${llmError}\n`)
        }
      } else {
        console.log('[ScanTarget] No vulnerabilities found, skipping LLM analysis')
      }

      setScanResult(scanData)
      setScanState('complete')
      console.log('[ScanTarget] Scan pipeline complete')
      return { success: true }
    } else {
      return { success: false, errorMessage: result.message || 'Scan failed' }
    }
  }

  const startScan = async () => {
    setScanState('scanning')
    setScanError(null)
    setScanLogs([]) // Clear previous logs
    setIsInputCollapsed(true) // Auto-collapse input section
    setRetryAttempt(0)

    try {
      if (window.electronAPI) {
        let attempt = 0
        let lastError = ''

        while (attempt <= MAX_RETRIES) {
          if (attempt > 0) {
            // Show retry state in UI
            console.log(`[ScanTarget] Auto-retrying scan (attempt ${attempt + 1}/${MAX_RETRIES + 1})`)
            setScanState('retrying')
            setRetryAttempt(attempt)
            appendLog(`\n${'─'.repeat(52)}\n`)
            appendLog(`  ⟳ Scan failed — automatically retrying (attempt ${attempt + 1} of ${MAX_RETRIES + 1})\n`)
            appendLog(`  Previous error: ${lastError}\n`)
            appendLog(`${'─'.repeat(52)}\n\n`)

            // Brief pause before retrying so the user can see the message
            await new Promise(resolve => setTimeout(resolve, 3000))
            setScanState('scanning')
          }

          const { success, errorMessage } = await runScanAttempt()

          if (success) {
            return // Done — state is already set to 'complete' inside runScanAttempt
          }

          lastError = errorMessage || 'Unknown error'
          attempt++
        }

        // All attempts exhausted
        setScanError(`Scan failed after ${MAX_RETRIES + 1} attempts: ${lastError}`)
        setScanState('error')
        console.error(`[ScanTarget] Scan failed after ${MAX_RETRIES + 1} attempts: ${lastError}`)
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
      setScanError('Scan failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
      setScanState('error')
    }
  }

  const handleReset = () => {
    reset()
    setValidationResult(null)
    setDisclaimerAccepted(false)
    setIsInputCollapsed(false)
    setRetryAttempt(0)
  }

  const stopScan = async () => {
    if (!window.electronAPI) return

    try {
      const result = await window.electronAPI.scanner.abort()
      if (result.success) {
        appendLog('\n[User] Scan aborted\n')
        setScanError('Scan was stopped by user')
        setScanState('error')
        setIsInputCollapsed(false) // Auto-expand input when stopped
      }
    } catch (err) {
      console.error('Failed to abort scan:', err)
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Input Section - Collapsible with Header */}
        <div className="border border-border bg-card overflow-hidden transition-all duration-300">
          {/* Collapse Header */}
          <button
            onClick={() => setIsInputCollapsed(!isInputCollapsed)}
            className="w-full p-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
          >
            <div className="text-left flex-1">
              <h2 className="text-xl mb-1">Target Scanner</h2>
              <p className="text-muted-foreground text-xs font-mono">
                Enter a target URL or IP address to initiate vulnerability scanning.
              </p>
              {isInputCollapsed && target && (
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm font-mono text-foreground">
                    {target} <span className="text-muted-foreground">• Progressive Scan</span>
                  </p>
                  {validationResult && (
                    <span className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded ${validationResult.requiresDisclaimer
                      ? 'border border-amber-500/30 text-foreground font-bold'
                      : 'bg-[hsl(var(--low))]/20 text-[hsl(var(--low))]'
                      }`}>
                      {validationResult.requiresDisclaimer ? (
                        <ShieldAlert className="w-3 h-3" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                      {validationResult.requiresDisclaimer ? 'Disclaimer accepted' : 'Known target'}
                    </span>
                  )}
                </div>
              )}
            </div>
            {isInputCollapsed ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {/* Collapsible Content */}
          <div className={`transition-all duration-300 ease-in-out ${isInputCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'
            }`}>
            <div className="p-4 pt-2 space-y-4 border-t border-border">
              <label className="block">
                <div className="flex gap-0">
                  <div className="flex-1 relative">
                    {/* Ghost text for tab-completion */}
                    {tabSuggestion && (
                      <div className="absolute inset-0 px-4 py-3 font-mono pointer-events-none flex items-center">
                        <span className="invisible">{target}</span>
                        <span className="text-muted-foreground/40">{tabSuggestion.slice(target.length)}</span>
                      </div>
                    )}
                    <input
                      type="text"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      onKeyDown={handleTabComplete}
                      placeholder="testphp.vulnweb.com"
                      disabled={scanState === 'scanning' || scanState === 'retrying'}
                      autoComplete="off"
                      className="w-full px-4 py-3 bg-input border border-border text-foreground font-mono 
                               placeholder:text-muted-foreground focus:outline-none focus:border-primary
                               disabled:opacity-50 relative z-10 bg-transparent"
                    />
                  </div>
                  <button
                    onClick={validateTarget}
                    disabled={scanState === 'scanning' || scanState === 'validating' || scanState === 'retrying'}
                    className="px-6 py-3 bg-primary text-primary-foreground font-mono uppercase tracking-wider
                             border border-primary hover:bg-primary/90 disabled:opacity-50
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

              {/* Target hint & validation result */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-mono">
                  Enter any target URL or IP address to scan
                </p>
                {validationResult && (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 ${validationResult.requiresDisclaimer
                    ? 'text-foreground font-bold border border-amber-500/30'
                    : 'bg-[hsl(var(--low))]/20 text-[hsl(var(--low))] border border-[hsl(var(--low))]/30'
                    }`}>
                    {validationResult.requiresDisclaimer ? (
                      <ShieldAlert className="w-3 h-3" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    {validationResult.requiresDisclaimer ? 'Disclaimer required' : 'Known safe target'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>



        {/* Confirmation Dialog */}
        {scanState === 'confirming' && (
          <div className="border border-primary p-6 bg-card space-y-4 animate-stagger-in">
            <div className="flex items-start gap-3">
              <div className="space-y-4 w-full">
                <div>
                  <h3 className="text-lg mb-1">Confirm Scan</h3>
                  <p className="text-muted-foreground text-sm font-mono">
                    You are about to scan <span className="text-primary">{target}</span>.
                    This will run a progressive scan: quick discovery first, then deep vulnerability testing.
                  </p>
                </div>

                {/* UK Computer Misuse Act Disclaimer — shown for non-whitelisted targets */}
                {validationResult?.requiresDisclaimer && (
                  <div className="border border-amber-500/50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-foreground flex-shrink-0" />
                      <h4 className="text-sm font-mono uppercase tracking-wider text-foreground font-bold">Legal Disclaimer</h4>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground space-y-2 pl-7 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80">
                      <p>
                        You must ensure that scanning activities comply not only with applicable law
                        (e.g., <a href="https://www.legislation.gov.uk/ukpga/1990/18/contents" target="_blank" rel="noopener noreferrer" className="font-bold">Computer Misuse Act 1990</a>) but also with the
                        <span className="text-foreground font-bold"> Terms of Service</span> and
                        <span className="text-foreground font-bold"> Acceptable Use Policies</span> of any hosting provider,
                        cloud provider, or infrastructure operator associated with the target system.
                      </p>
                      <p>
                        This tool performs <span className="text-foreground">full-port scanning, NSE vulnerability scripts,
                        and aggressive service fingerprinting</span> which may:
                      </p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Trigger abuse detection systems (e.g., <a href="https://www.netlify.com/legal/acceptable-use-policy/" target="_blank" rel="noopener noreferrer">Netlify AUP</a>, <a href="https://aws.amazon.com/aup/" target="_blank" rel="noopener noreferrer">AWS AUP</a>, <a href="https://www.microsoft.com/en-us/legal/terms-of-use" target="_blank" rel="noopener noreferrer">Azure ToS</a>)</li>
                        <li>Result in your IP being blocked by the target infrastructure</li>
                        <li>Lead to account suspension with hosting or cloud providers</li>
                        <li>Constitute a <a href="https://www.legislation.gov.uk/ukpga/1990/18/section/1" target="_blank" rel="noopener noreferrer">criminal offence</a> if performed without authorisation</li>
                      </ul>
                      <p className="pt-1">
                        By proceeding, you confirm that:
                      </p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>You have <span className="text-foreground font-bold">explicit written authorisation</span> from the system owner to perform this scan.</li>
                        <li>You have verified that scanning is <span className="text-foreground font-bold">permitted under the target's hosting provider ToS/AUP</span>.</li>
                        <li>You accept full responsibility for any consequences, including legal action, IP blocking, or account suspension.</li>
                        <li>This tool is intended for <span className="text-foreground font-bold">authorised security testing only</span>.</li>
                      </ul>
                    </div>
                    <label className="flex items-center gap-3 pl-7 pt-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={disclaimerAccepted}
                        onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                        className="w-4 h-4 accent-amber-500"
                      />
                      <span className="text-xs font-mono text-foreground">
                        I confirm I have authorisation to scan this target
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                onClick={startScan}
                disabled={validationResult?.requiresDisclaimer && !disclaimerAccepted}
                className="px-6 py-3 bg-primary text-primary-foreground font-mono uppercase tracking-wider
                         border border-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-transform"
              >
                Start Scan
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-card text-foreground font-mono uppercase tracking-wider
                         border border-border hover:bg-muted
                         transition-transform"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Scan Progress Stepper - shows during scanning and analyzing */}
        <ScanProgressStepper currentState={scanState} scanLogs={scanLogs} />

        {/* Retrying Header */}
        {scanState === 'retrying' && (
          <div className="border border-amber-500 bg-amber-500/10 p-4 flex items-center gap-3 animate-stagger-in" style={{ animationDelay: '150ms' }}>
            <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
            <div className="flex-1">
              <p className="font-mono text-sm font-bold text-amber-500">Retrying Scan (Attempt {retryAttempt + 1} of {MAX_RETRIES + 1})</p>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                Previous attempt failed — automatically retrying in a moment...
              </p>
            </div>
            <button
              onClick={stopScan}
              className="px-4 py-2 bg-[hsl(var(--critical))]/10 text-[hsl(var(--critical))] font-mono text-xs uppercase tracking-wider
                       border border-[hsl(var(--critical))] hover:bg-[hsl(var(--critical))]/20 transition-colors
                       flex items-center gap-2"
            >
              <Square className="w-3 h-3 fill-current" /> Stop
            </button>
          </div>
        )}

        {/* Scanning Header - Phase 1 */}
        {scanState === 'scanning' && (
          <div className="border border-border bg-card p-4 flex items-center gap-3 animate-stagger-in" style={{ animationDelay: '150ms' }}>
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <div className="flex-1">
              <p className="font-mono text-sm font-bold">Phase 1: Quick Discovery</p>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                Scanning {target} • Top 100 ports • ~2-4 min
              </p>
            </div>
            <button
              onClick={stopScan}
              className="px-4 py-2 bg-[hsl(var(--critical))]/10 text-[hsl(var(--critical))] font-mono text-xs uppercase tracking-wider
                       border border-[hsl(var(--critical))] hover:bg-[hsl(var(--critical))]/20 transition-colors
                       flex items-center gap-2"
            >
              <Square className="w-3 h-3 fill-current" /> Stop
            </button>
          </div>
        )}

        {/* Phase 2 Header - Deep Scan (with Phase 1 results summary) */}
        {scanState === 'deepening' && scanResult && (
          <div className="space-y-3 animate-stagger-in" style={{ animationDelay: '150ms' }}>
            {/* Phase 1 Results Summary */}
            <div className="border border-[hsl(var(--low))]/50 bg-[hsl(var(--low))]/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-4 h-4 text-[hsl(var(--low))]" />
                <span className="text-xs font-mono uppercase tracking-wider text-[hsl(var(--low))]">Phase 1 Results</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold font-mono">{scanResult.securityScore?.overall ?? '—'}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">SCORE</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold font-mono">{scanResult.ports.length}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">PORTS</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold font-mono">{scanResult.vulnerabilities.length}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">VULNS</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold font-mono">{scanResult.securityScore?.grade ?? '—'}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">GRADE</div>
                </div>
              </div>
            </div>
            {/* Phase 2 Progress */}
            <div className="border border-border bg-card p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <div className="flex-1">
                <p className="font-mono text-sm font-bold">Phase 2: Deep Vulnerability Scan</p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  All 65535 ports • SQLi • XSS • CSRF • Enumeration • ~10-25 min
                </p>
              </div>
              <button
                onClick={stopScan}
                className="px-4 py-2 bg-[hsl(var(--critical))]/10 text-[hsl(var(--critical))] font-mono text-xs uppercase tracking-wider
                         border border-[hsl(var(--critical))] hover:bg-[hsl(var(--critical))]/20 transition-colors
                         flex items-center gap-2"
              >
                <Square className="w-3 h-3 fill-current" /> Stop
              </button>
            </div>
          </div>
        )}

        {/* AI Analysis Header */}
        {scanState === 'analyzing' && (
          <div className="border border-primary bg-card p-4 flex items-center gap-3 animate-stagger-in" style={{ animationDelay: '150ms' }}>
            <div className="flex-1">
              <p className="font-mono text-sm font-bold">Analyzing with AI</p>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                Processing vulnerabilities through Gemini...
              </p>
            </div>
            <button
              onClick={stopScan}
              className="px-4 py-2 bg-[hsl(var(--critical))]/10 text-[hsl(var(--critical))] font-mono text-xs uppercase tracking-wider
                       border border-[hsl(var(--critical))] hover:bg-[hsl(var(--critical))]/20 transition-colors
                       flex items-center gap-2"
            >
              <Square className="w-3 h-3 fill-current" /> Stop
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && scanState === 'error' && (
          <div className="border border-[hsl(var(--critical))] p-6 bg-[hsl(var(--critical))]/10 animate-stagger-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[hsl(var(--critical))] mt-0.5" />
              <div>
                <p className="font-mono text-sm text-[hsl(var(--critical))]">{error}</p>
                <button
                  onClick={handleReset}
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
          <div className="border border-[hsl(var(--low))] p-6 bg-[hsl(var(--low))]/10 space-y-4 animate-stagger-in">
            <div className="flex items-start gap-3">
              <Check className="w-6 h-6 text-[hsl(var(--low))] mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg mb-1">Scan Complete</h3>
                <p className="text-muted-foreground text-sm font-mono mb-3">
                  Found {scanResult.vulnerabilities.length} vulnerabilities across {scanResult.ports.length} open ports
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/dashboard', { state: { target } })}
                    className="px-6 py-3 bg-primary text-primary-foreground font-mono uppercase tracking-wider
                             border border-primary hover:bg-primary/90 transition-transform flex items-center gap-2"
                  >
                    View Results <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-card text-foreground font-mono uppercase tracking-wider
                             border border-border hover:bg-muted transition-transform"
                  >
                    New Scan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
