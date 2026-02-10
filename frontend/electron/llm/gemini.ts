import type { GeminiConfig, LLMAnalysisRequest, LLMAnalysisResult, VulnerabilityAnalysis } from './types'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-2.0-flash'
const FALLBACK_MODEL = 'gemini-2.0-flash-lite'
const DEFAULT_TIMEOUT = 30000
const DEFAULT_MAX_RETRIES = 2

export class GeminiClient {
  private apiKey: string
  private model: string
  private fallbackModel: string
  private maxRetries: number
  private timeout: number

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey
    this.model = config.model || DEFAULT_MODEL
    this.fallbackModel = FALLBACK_MODEL
    this.maxRetries = config.maxRetries || DEFAULT_MAX_RETRIES
    this.timeout = config.timeout || DEFAULT_TIMEOUT
  }

  async analyzeVulnerabilities(request: LLMAnalysisRequest): Promise<LLMAnalysisResult> {
    const startTime = Date.now()

    try {
      const prompt = this.buildPrompt(request)
      
      // Try primary model first, fallback on failure
      let response: any
      let usedModel = this.model
      
      try {
        response = await this.callGeminiWithRetry(prompt, this.model)
      } catch (primaryError) {
        console.log(`Primary model ${this.model} failed, trying fallback ${this.fallbackModel}`)
        usedModel = this.fallbackModel
        response = await this.callGeminiWithRetry(prompt, this.fallbackModel)
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

  private async callGeminiWithRetry(prompt: string, model: string, attempt = 1): Promise<any> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(
        `${GEMINI_API_BASE}/${model}:generateContent?key=${this.apiKey}`,
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
              maxOutputTokens: 4096, // Reduced from 8192
            },
          }),
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Gemini API error (${response.status}): ${error}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      if (attempt < this.maxRetries) {
        // Check if it's a rate limit error - wait longer
        const isRateLimit = error instanceof Error && error.message.includes('429')
        const delay = isRateLimit ? 5000 * attempt : 1000 * attempt
        console.log(`Retry ${attempt}/${this.maxRetries} for ${model} after ${delay}ms`)
        await this.sleep(delay)
        return this.callGeminiWithRetry(prompt, model, attempt + 1)
      }
      throw error
    }
  }

  private parseResponse(response: any, vulnerabilityIds: string[]): VulnerabilityAnalysis[] {
    try {
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) {
        throw new Error('No response text from Gemini')
      }

      // Extract JSON from response (handle markdown code blocks)
      let jsonText = text.trim()
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '')
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '')
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
