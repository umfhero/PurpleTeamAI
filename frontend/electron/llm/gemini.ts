import type { GeminiConfig, LLMAnalysisRequest, LLMAnalysisResult, VulnerabilityAnalysis } from './types'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-2.0-flash'
const DEFAULT_TIMEOUT = 30000
const DEFAULT_MAX_RETRIES = 3

export class GeminiClient {
  private apiKey: string
  private model: string
  private maxRetries: number
  private timeout: number

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey
    this.model = config.model || DEFAULT_MODEL
    this.maxRetries = config.maxRetries || DEFAULT_MAX_RETRIES
    this.timeout = config.timeout || DEFAULT_TIMEOUT
  }

  async analyzeVulnerabilities(request: LLMAnalysisRequest): Promise<LLMAnalysisResult> {
    const startTime = Date.now()

    try {
      const prompt = this.buildPrompt(request)
      const response = await this.callGeminiWithRetry(prompt)
      
      const analyses = this.parseResponse(response, request.vulnerabilities.map(v => v.id))
      
      return {
        success: true,
        analyses,
        model: this.model,
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
    const vulnsJson = JSON.stringify(request.vulnerabilities, null, 2)
    
    return `You are a cybersecurity expert analyzing vulnerability scan results for ${request.target}.

SCAN DATA:
${vulnsJson}

For EACH vulnerability, provide:
1. Plain-English Summary: Explain what this vulnerability means in simple terms
2. Affected Endpoints: List specific paths/endpoints that may be exploited
3. Severity Justification: Explain why this severity rating is appropriate
4. Remediation Steps: Provide 3-5 specific, actionable steps to fix this (ordered by priority)
5. OWASP Category: Map to OWASP Top 10 category (e.g., "A01:2021 - Broken Access Control")
6. Confidence Score: Rate your confidence in this analysis (0.0 to 1.0)

Format your response as a JSON array with this structure:
[
  {
    "vulnerabilityId": "the vulnerability ID from input",
    "plainEnglishSummary": "...",
    "affectedEndpoints": ["...", "..."],
    "severityJustification": "...",
    "remediationSteps": ["...", "...", "..."],
    "owaspCategory": "A01:2021 - Broken Access Control",
    "confidenceScore": 0.85
  }
]

Provide ONLY the JSON array, no additional text.`
  }

  private async callGeminiWithRetry(prompt: string, attempt = 1): Promise<any> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(
        `${GEMINI_API_BASE}/${this.model}:generateContent?key=${this.apiKey}`,
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
              maxOutputTokens: 8192,
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
        console.log(`Retry ${attempt}/${this.maxRetries} after error:`, error)
        await this.sleep(1000 * attempt) // Exponential backoff
        return this.callGeminiWithRetry(prompt, attempt + 1)
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
