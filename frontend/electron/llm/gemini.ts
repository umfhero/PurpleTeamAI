import type { GeminiConfig, LLMAnalysisRequest, LLMAnalysisResult, VulnerabilityAnalysis } from './types'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
// Models to try, in priority order. Each has its own daily quota bucket.
const MODEL_CHAIN = [
  'gemini-2.5-flash',          // Best quality, fast
  'gemini-2.5-flash-lite',     // Lighter variant
  'gemini-2.0-flash',          // Previous gen
  'gemini-2.0-flash-lite',     // Previous gen lite
]
const DEFAULT_TIMEOUT = 120000  // 2 minutes — Gemini 2.5 can take 60s+ for multi-vuln analysis
const DEFAULT_MAX_RETRIES = 3

export class GeminiClient {
  private apiKeys: string[]
  private maxRetries: number
  private timeout: number

  constructor(config: GeminiConfig) {
    // Build list of available API keys
    this.apiKeys = [config.apiKey]
    if (config.fallbackApiKey) {
      this.apiKeys.push(config.fallbackApiKey)
    }
    this.maxRetries = config.maxRetries || DEFAULT_MAX_RETRIES
    this.timeout = config.timeout || DEFAULT_TIMEOUT
  }

  async analyzeVulnerabilities(request: LLMAnalysisRequest): Promise<LLMAnalysisResult> {
    const startTime = Date.now()

    try {
      const prompt = this.buildPrompt(request)
      
      // Build every (model, key) combination to try
      const attempts: Array<{ model: string; key: string; label: string }> = []
      for (const model of MODEL_CHAIN) {
        for (let i = 0; i < this.apiKeys.length; i++) {
          attempts.push({ model, key: this.apiKeys[i], label: `key${i + 1}` })
        }
      }

      let response: any
      let usedModel = ''
      let lastError: Error | null = null

      for (const { model, key, label } of attempts) {
        try {
          console.log(`[Gemini] Trying ${model} with ${label}...`)
          response = await this.callGeminiWithRetry(prompt, model, key)
          usedModel = model
          console.log(`[Gemini] Success with ${model} + ${label}`)
          break // Success — stop trying
        } catch (err: any) {
          lastError = err instanceof Error ? err : new Error(String(err))
          const isQuota = lastError.message.includes('429')
          console.warn(`[Gemini] ${model} + ${label} failed${isQuota ? ' (quota)' : ''}: ${lastError.message.slice(0, 100)}`)
          // Continue to next combination
        }
      }

      if (!response) {
        throw lastError || new Error('All model/key combinations exhausted')
      }
      
      const analyses = this.parseResponse(response, request.vulnerabilities.map(v => v.id))
      
      return {
        success: true,
        analyses,
        model: usedModel,
        tokensUsed: response.usageMetadata?.totalTokenCount,
        processingTime: Date.now() - startTime,
      }
    } catch (error) {
      console.error('Gemini analysis failed:', error)
      return {
        success: false,
        analyses: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      }
    }
  }

  private buildPrompt(request: LLMAnalysisRequest): string {
    // Compress vulnerability data - only include essential fields
    const compactVulns = request.vulnerabilities.map(v => ({
      id: v.id,
      name: v.name,
      severity: v.severity,
      port: v.port,
      description: v.description?.slice(0, 500), // Limit description length
      evidence: v.evidence?.slice(0, 200),
    }))
    const vulnsJson = JSON.stringify(compactVulns)
    
    return `Analyze vulnerabilities for ${request.target}.

DATA: ${vulnsJson}

For each vulnerability, respond with JSON array:
[{"vulnerabilityId":"id","plainEnglishSummary":"what this means","affectedEndpoints":["paths"],"severityJustification":"why this rating","remediationSteps":["fix1","fix2","fix3"],"owaspCategory":"A01:2021 - Category","confidenceScore":0.85}]

Keep summaries concise (2-3 sentences). Provide 3 remediation steps. JSON only, no other text.`
  }

  private async callGeminiWithRetry(prompt: string, model: string, apiKey: string, attempt = 1): Promise<any> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(
        `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 16384, // Need room for 8+ detailed vuln analyses
            },
          }),
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        
        // For 429 rate limits, parse the retry delay and attach it to the error
        if (response.status === 429) {
          const parsed = this.parseRateLimitError(errorText)
          const err = new Error(`Gemini API error (429): ${errorText}`) as any
          err.retryDelay = parsed.retryDelay
          err.isDailyQuota = parsed.isDailyQuota
          err.statusCode = 429
          throw err
        }
        
        throw new Error(`Gemini API error (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      return data
    } catch (error: any) {
      if (attempt < this.maxRetries) {
        // If daily quota is exhausted, retrying won't help — fail immediately
        if (error?.isDailyQuota) {
          console.warn(`[Gemini] Daily quota exhausted for ${model} — not retrying`)
          throw error
        }
        
        // For per-minute rate limits, use the API-provided retry delay
        const isRateLimit = error?.statusCode === 429
        let delay: number
        if (isRateLimit && error.retryDelay) {
          delay = error.retryDelay
        } else if (isRateLimit) {
          delay = 15000 * attempt  // Default 15s for rate limits
        } else {
          delay = 2000 * attempt   // 2s backoff for other errors
        }
        
        console.log(`[Gemini] Retry ${attempt}/${this.maxRetries} for ${model} after ${Math.round(delay / 1000)}s${isRateLimit ? ' (rate limited)' : ''}`)
        await this.sleep(delay)
        return this.callGeminiWithRetry(prompt, model, apiKey, attempt + 1)
      }
      throw error
    }
  }

  /**
   * Parse a 429 error response to extract retry delay and determine if it's a daily quota issue.
   */
  private parseRateLimitError(errorText: string): { retryDelay: number; isDailyQuota: boolean } {
    let retryDelay = 15000 // default 15s
    let isDailyQuota = false
    
    try {
      const parsed = JSON.parse(errorText)
      const details = parsed?.error?.details || []
      
      // Extract retry delay from RetryInfo
      for (const detail of details) {
        if (detail['@type']?.includes('RetryInfo') && detail.retryDelay) {
          const delayStr = String(detail.retryDelay)
          const seconds = parseFloat(delayStr.replace('s', ''))
          if (!isNaN(seconds)) {
            retryDelay = Math.ceil(seconds * 1000) + 1000 // Add 1s buffer
          }
        }
      }
      
      // Check if it's a daily quota (PerDay in quotaId) — no point retrying
      for (const detail of details) {
        if (detail['@type']?.includes('QuotaFailure')) {
          for (const violation of detail.violations || []) {
            if (violation.quotaId?.includes('PerDay')) {
              isDailyQuota = true
            }
          }
        }
      }
      
      // Also check if the limit is literally 0 — free tier fully exhausted
      const msg = parsed?.error?.message || ''
      if (msg.includes('limit: 0')) {
        isDailyQuota = true
      }
    } catch {
      // If we can't parse, use defaults
    }
    
    return { retryDelay, isDailyQuota }
  }

  private parseResponse(response: any, vulnerabilityIds: string[]): VulnerabilityAnalysis[] {
    try {
      const parts = response.candidates?.[0]?.content?.parts
      if (!parts || parts.length === 0) {
        console.error('[Gemini] No parts in response:', JSON.stringify(response).slice(0, 500))
        throw new Error('No response text from Gemini')
      }

      // Gemini 2.5+ "thinking" models return multiple parts:
      //   parts[0..n-1] have { thought: true, text: "..." } (internal reasoning)
      //   parts[n] has { text: "..." } (the actual answer)
      // Find the LAST non-thought part, which contains the real output.
      let text: string | undefined
      for (let i = parts.length - 1; i >= 0; i--) {
        if (!parts[i].thought && parts[i].text) {
          text = parts[i].text
          break
        }
      }

      // Fallback: if every part is a thought (shouldn't happen), use the last one
      if (!text) {
        text = parts[parts.length - 1].text
      }

      if (!text) {
        console.error('[Gemini] No usable text in parts:', JSON.stringify(parts).slice(0, 500))
        throw new Error('No response text from Gemini')
      }

      console.log('[Gemini] Raw response text (first 500 chars):', text.slice(0, 500))
      console.log('[Gemini] Raw response text (last 200 chars):', text.slice(-200))

      // Extract JSON array from response — robust extraction
      let jsonText = this.extractJsonArray(text)
      if (!jsonText) {
        console.error('[Gemini] Could not find JSON array in response. Full text:', text)
        throw new Error('No JSON array found in LLM response')
      }

      const analyses = JSON.parse(jsonText) as VulnerabilityAnalysis[]
      
      // Validate that all vulnerabilities were analyzed
      for (const vulnId of vulnerabilityIds) {
        if (!analyses.find(a => a.vulnerabilityId === vulnId)) {
          console.warn(`Missing analysis for vulnerability: ${vulnId}`)
        }
      }

      return analyses
    } catch (error) {
      console.error('Failed to parse Gemini response:', error)
      throw new Error('Failed to parse LLM response as JSON')
    }
  }

  /**
   * Robustly extract a JSON array from LLM output.
   * Handles: raw JSON, ```json blocks, JSON embedded in prose, trailing commas, etc.
   */
  private extractJsonArray(text: string): string | null {
    // Strategy 1: Strip markdown code fences and try direct parse
    let cleaned = text.trim()
    // Remove ```json ... ``` or ``` ... ```
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '')
    cleaned = cleaned.trim()
    try {
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) return cleaned
    } catch { /* continue */ }

    // Strategy 2: Find the outermost [ ... ] bracket pair
    const firstBracket = text.indexOf('[')
    const lastBracket = text.lastIndexOf(']')
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const candidate = text.slice(firstBracket, lastBracket + 1)
      try {
        const parsed = JSON.parse(candidate)
        if (Array.isArray(parsed)) return candidate
      } catch {
        // Strategy 3: Try fixing trailing commas before ] 
        const fixed = candidate.replace(/,\s*]/g, ']')
        try {
          const parsed = JSON.parse(fixed)
          if (Array.isArray(parsed)) return fixed
        } catch { /* continue */ }
      }
    }

    return null
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
