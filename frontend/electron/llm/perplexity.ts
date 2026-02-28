import type { LLMAnalysisRequest, LLMAnalysisResult, VulnerabilityAnalysis } from './types'

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions'

// Models in priority order (Pro plan has access to all)
const PERPLEXITY_MODELS = [
  'sonar-pro',        // Most capable, 200k context
  'sonar',            // Lighter / faster
]

const DEFAULT_TIMEOUT = 60000  // 60s — Perplexity can be slower due to web search

export interface PerplexityConfig {
  apiKey: string
  timeout?: number
}

export class PerplexityClient {
  private apiKey: string
  private timeout: number

  constructor(config: PerplexityConfig) {
    this.apiKey = config.apiKey
    this.timeout = config.timeout || DEFAULT_TIMEOUT
  }

  async analyzeVulnerabilities(request: LLMAnalysisRequest): Promise<LLMAnalysisResult> {
    const startTime = Date.now()

    try {
      const prompt = this.buildPrompt(request)
      let response: any
      let usedModel = ''
      let lastError: Error | null = null

      for (const model of PERPLEXITY_MODELS) {
        try {
          console.log(`[Perplexity] Trying ${model}...`)
          response = await this.callPerplexity(prompt, model)
          usedModel = model
          console.log(`[Perplexity] Success with ${model}`)
          break
        } catch (err: any) {
          lastError = err instanceof Error ? err : new Error(String(err))
          console.warn(`[Perplexity] ${model} failed: ${lastError.message.slice(0, 150)}`)
        }
      }

      if (!response) {
        throw lastError || new Error('All Perplexity models failed')
      }

      const analyses = this.parseResponse(response, request.vulnerabilities.map(v => v.id))

      return {
        success: true,
        analyses,
        model: `perplexity/${usedModel}`,
        tokensUsed: response.usage?.total_tokens,
        processingTime: Date.now() - startTime,
      }
    } catch (error) {
      console.error('[Perplexity] Analysis failed:', error)
      return {
        success: false,
        analyses: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      }
    }
  }

  private buildPrompt(request: LLMAnalysisRequest): string {
    // Same prompt format as Gemini for consistent output
    const compactVulns = request.vulnerabilities.map(v => ({
      id: v.id,
      name: v.title,
      severity: v.severity,
      port: v.port,
      description: v.description?.slice(0, 500),
      evidence: v.output?.slice(0, 200),
    }))
    const vulnsJson = JSON.stringify(compactVulns)

    return `Analyze vulnerabilities for ${request.target}.

DATA: ${vulnsJson}

For each vulnerability, respond with JSON array:
[{"vulnerabilityId":"id","plainEnglishSummary":"what this means","affectedEndpoints":["paths"],"severityJustification":"why this rating","remediationSteps":["fix1","fix2","fix3"],"owaspCategory":"A01:2021 - Category","confidenceScore":0.85}]

Keep summaries concise (2-3 sentences). Provide 3 remediation steps. JSON only, no other text.`
  }

  private async callPerplexity(prompt: string, model: string): Promise<any> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(PERPLEXITY_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a cybersecurity vulnerability analyst. Respond only with valid JSON, no markdown, no explanation.'
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Perplexity API error (${response.status}): ${errorText}`)
      }

      return await response.json()
    } catch (error: any) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  private parseResponse(response: any, vulnerabilityIds: string[]): VulnerabilityAnalysis[] {
    const text = response.choices?.[0]?.message?.content
    if (!text) {
      console.error('[Perplexity] No content in response:', JSON.stringify(response).slice(0, 500))
      throw new Error('No response content from Perplexity')
    }

    console.log('[Perplexity] Raw response (first 300 chars):', text.slice(0, 300))

    // Extract JSON — handle markdown code blocks
    let jsonText = text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '')
    }

    const analyses = JSON.parse(jsonText) as VulnerabilityAnalysis[]

    for (const vulnId of vulnerabilityIds) {
      if (!analyses.find(a => a.vulnerabilityId === vulnId)) {
        console.warn(`[Perplexity] Missing analysis for vulnerability: ${vulnId}`)
      }
    }

    return analyses
  }
}
