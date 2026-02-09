import { useState, useEffect } from 'react'
import { Crosshair, AlertTriangle, Check, Loader2, ArrowRight, Brain, Zap, Circle, ChevronDown, ChevronUp, Square } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useScanStore } from '../lib/useScanStore'
import type { ScanState } from '../lib/scanStore'

type ScanType = 'quick' | 'vuln' | 'full'

// Progress step definitions
const PROGRESS_STEPS = [
  { id: 'validating', label: 'Validating', description: 'Checking allowlist' },
  { id: 'confirming', label: 'Confirm', description: 'Awaiting user action' },
  { id: 'scanning', label: 'Scanning', description: 'Running Nmap' },
  { id: 'analyzing', label: 'Analyzing', description: 'AI processing' },
  { id: 'complete', label: 'Complete', description: 'Results ready' },
] as const

// Progress Stepper Component
function ScanProgressStepper({ currentState, scanLogs }: { currentState: ScanState; scanLogs: string[] }) {
  const [visibleSteps, setVisibleSteps] = useState<number>(0)
  
  // Get the current step index
  const getCurrentStepIndex = () => {
    if (currentState === 'idle' || currentState === 'error') return -1
    return PROGRESS_STEPS.findIndex(step => step.id === currentState)
  }
  
  const currentIndex = getCurrentStepIndex()
  
  // Stagger reveal animation - reveal steps one by one
  useEffect(() => {
    if (currentIndex >= 0) {
      const timer = setTimeout(() => {
        setVisibleSteps(prev => Math.min(prev + 1, currentIndex + 1))
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [currentIndex])
  
  // Reset visible steps when going back to idle
  useEffect(() => {
    if (currentState === 'idle') {
      setVisibleSteps(0)
    }
  }, [currentState])

  if (currentState === 'idle' || currentState === 'error') return null

  return (
    <div className="border border-border bg-card animate-stagger-in">
      {/* Header */}
      <div className="border-b border-border p-4">
        <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Scan Progress</h3>
      </div>
      
      {/* Progress Steps */}
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          {PROGRESS_STEPS.map((step, index) => {
            const isActive = step.id === currentState
            const isComplete = currentIndex > index
            const isVisible = index <= visibleSteps
            
            return (
              <div 
                key={step.id}
                className={`flex-1 transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                style={{ 
                  animationDelay: `${index * 100}ms`,
                  transitionDelay: `${index * 50}ms`
                }}
              >
                {/* Step Item */}
                <div className={`border p-3 transition-colors ${
                  isActive 
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
                    <span className={`text-xs font-mono uppercase tracking-wider ${
                      isActive ? 'text-primary' : isComplete ? 'text-[hsl(var(--low))]' : 'text-muted-foreground'
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
      
      {/* Live Terminal - only show during scanning/analyzing */}
      {(currentState === 'scanning' || currentState === 'analyzing') && scanLogs.length > 0 && (
        <div className="border-t border-border">
          <div className="p-2 border-b border-border bg-muted/20 flex items-center gap-2">
            <Zap className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Live Output
            </span>
          </div>
          <div 
            className="bg-[oklch(0.12_0.015_80)] p-3 font-mono text-[11px] text-[oklch(0.80_0.015_80)] h-32 overflow-y-auto"
          >
            {scanLogs.slice(-20).map((line, i) => (
              <div 
                key={i} 
                className="whitespace-pre-wrap break-all animate-log-line"
                style={{ animationDelay: `${i * 20}ms` }}
              >
                <span className="text-primary/60 mr-2">{'>'}</span>{line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const SCAN_TYPE_INFO: Record<ScanType, { label: string; description: string; time: string }> = {
  quick: { label: 'Quick Scan', description: 'Fast port scan (top 100 ports)', time: '~1-2 min' },
  vuln: { label: 'Vulnerability Scan', description: 'Service detection + vuln scripts', time: '~5-15 min' },
  full: { label: 'Full Scan', description: 'All 65535 ports + services', time: '~30+ min' },
}

export default function ScanTarget() {
  const navigate = useNavigate()
  
  // Use global scan store for persistent state
  const {
    scanState,
    target,
    scanType,
    scanLogs,
    scanResult,
    error,
    setScanState,
    setTarget,
    setScanType,
    setScanLogs,
    appendLog,
    setScanResult,
    setScanError,
    setProgressCleanup,
    reset,
  } = useScanStore()
  
  const [validationResult, setValidationResult] = useState<{ allowed: boolean; message: string } | null>(null)
  const [isInputCollapsed, setIsInputCollapsed] = useState(scanState === 'scanning' || scanState === 'analyzing')

  const validateTarget = async () => {
    if (!target.trim()) {
      setScanError('Please enter a target URL or IP')
      return
    }

    setScanState('validating')
    setScanError(null)

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
          setScanError('Target not allowed. Only authorized targets can be scanned.')
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
          setScanError('Target not allowed. Only authorized targets can be scanned.')
        }
      }
    } catch (err) {
      setScanError('Validation failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
      setScanState('error')
    }
  }

  const startScan = async () => {
    setScanState('scanning')
    setScanError(null)
    setScanLogs([]) // Clear previous logs
    setIsInputCollapsed(true) // Auto-collapse input section

    try {
      if (window.electronAPI) {
        // Set up progress listener - store cleanup in global store
        const removeListener = window.electronAPI.scanner.onProgress((line: string) => {
          appendLog(line)
        })
        setProgressCleanup(removeListener)

        // Step 1: Run Nmap scan
        console.log(`[ScanTarget] Starting ${scanType} scan for: ${target}`)
        const result = await window.electronAPI.scanner.runNmap({ target, scanType })
        
        // Clean up listener
        removeListener()
        setProgressCleanup(null)
        
        console.log(`[ScanTarget] Scan result:`, result)
        
        if (result.success && result.data) {
          const scanData = result.data
          
          // Step 2: Analyze with LLM if we have vulnerabilities
          if (scanData.vulnerabilities.length > 0) {
            console.log(`[ScanTarget] Starting LLM analysis for ${scanData.vulnerabilities.length} vulnerabilities`)
            setScanState('analyzing')
            appendLog('\n[LLM] Starting AI analysis...\n')
            
            try {
              const llmResult = await window.electronAPI.llm.analyzeVulnerabilities({
                vulnerabilities: scanData.vulnerabilities,
                target: scanData.target,
                scanTimestamp: scanData.timestamp,
              })
              
              if (llmResult.success) {
                scanData.llmAnalysis = llmResult
                console.log(`[ScanTarget] LLM analysis complete: ${llmResult.analyses.length} analyses`)
                appendLog(`[LLM] Analysis complete: ${llmResult.analyses.length} vulnerabilities analyzed\n`)
              } else {
                console.warn('[ScanTarget] LLM analysis failed:', llmResult.error)
                appendLog(`[LLM] Analysis failed: ${llmResult.error}\n`)
              }
            } catch (llmError) {
              console.error('[ScanTarget] LLM analysis error:', llmError)
              appendLog(`[LLM] Error: ${llmError}\n`)
              // Continue even if LLM fails - we still have scan results
            }
          } else {
            console.log('[ScanTarget] No vulnerabilities found, skipping LLM analysis')
          }
          
          setScanResult(scanData)
          setScanState('complete')
          console.log('[ScanTarget] Scan pipeline complete')
        } else {
          setScanError(result.message || 'Scan failed')
          setScanState('error')
          console.error('[ScanTarget] Scan failed:', result.message)
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
      setScanError('Scan failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
      setScanState('error')
    }
  }

  const handleReset = () => {
    reset()
    setValidationResult(null)
    setIsInputCollapsed(false)
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
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="border border-border p-6 bg-card">
        <h2 className="text-2xl mb-2">Target Scanner</h2>
        <p className="text-muted-foreground text-sm font-mono">
          Enter a target URL or IP address to initiate vulnerability scanning.
          Only allowlisted targets can be scanned.
        </p>
      </div>

      {/* Input Section - Collapsible */}
      <div className="border border-border bg-card overflow-hidden transition-all duration-300">
        {/* Collapse Header */}
        <button
          onClick={() => setIsInputCollapsed(!isInputCollapsed)}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="text-left flex-1">
            <span className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Target URL / IP
            </span>
            {isInputCollapsed && target && (
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm font-mono text-foreground">
                  {target} <span className="text-muted-foreground">• {SCAN_TYPE_INFO[scanType].label}</span>
                </p>
                {validationResult && (
                  <span className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded ${
                    validationResult.allowed
                      ? 'bg-[hsl(var(--low))]/20 text-[hsl(var(--low))]'
                      : 'bg-[hsl(var(--critical))]/20 text-[hsl(var(--critical))]'
                  }`}>
                    {validationResult.allowed ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <AlertTriangle className="w-3 h-3" />
                    )}
                    {validationResult.allowed ? 'Allowed' : 'Blocked'}
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
        <div className={`transition-all duration-300 ease-in-out ${
          isInputCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'
        }`}>
          <div className="p-6 pt-2 space-y-4 border-t border-border">
            <label className="block">
              <div className="flex gap-0">
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

            {/* Allowlist hint & validation result */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-mono">
                Allowed targets: testphp.vulnweb.com, localhost, 127.0.0.1
              </p>
              {validationResult && (
                <span className={`inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 ${
                  validationResult.allowed
                    ? 'bg-[hsl(var(--low))]/20 text-[hsl(var(--low))] border border-[hsl(var(--low))]/30'
                    : 'bg-[hsl(var(--critical))]/20 text-[hsl(var(--critical))] border border-[hsl(var(--critical))]/30'
                }`}>
                  {validationResult.allowed ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                  {validationResult.allowed ? 'Target allowed' : 'Target blocked'}
                </span>
              )}
            </div>

            {/* Scan Type Selector */}
            <div className="mt-4">
              <span className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                Scan Type
              </span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(Object.keys(SCAN_TYPE_INFO) as ScanType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setScanType(type)}
                    disabled={scanState === 'scanning'}
                    className={`p-3 border text-left transition-colors ${
                      scanType === type
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                    } disabled:opacity-50`}
                  >
                    <div className="font-mono text-sm font-semibold">{SCAN_TYPE_INFO[type].label}</div>
                    <div className="text-xs mt-1 opacity-70">{SCAN_TYPE_INFO[type].description}</div>
                    <div className="text-xs mt-1 text-primary">{SCAN_TYPE_INFO[type].time}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* Confirmation Dialog */}
      {scanState === 'confirming' && (
        <div className="border border-primary p-6 bg-card space-y-4 animate-stagger-in">
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

      {/* Scanning Header (additional context) */}
      {scanState === 'scanning' && (
        <div className="border border-border bg-card p-4 flex items-center gap-3 animate-stagger-in" style={{ animationDelay: '150ms' }}>
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <div className="flex-1">
            <p className="font-mono text-sm font-bold">Scanning {target}</p>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Running {SCAN_TYPE_INFO[scanType].label} • {SCAN_TYPE_INFO[scanType].time}
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

      {/* AI Analysis Header */}
      {scanState === 'analyzing' && (
        <div className="border border-primary bg-card p-4 flex items-center gap-3 animate-stagger-in" style={{ animationDelay: '150ms' }}>
          <Brain className="w-5 h-5 text-primary animate-pulse" />
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
                  onClick={() => navigate('/dashboard')}
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
