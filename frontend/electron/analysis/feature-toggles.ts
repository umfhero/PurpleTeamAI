// Feature Toggle Configuration
// Controls which analysis features are active during post-scan processing.
// Toggles are read at runtime so they can be changed between runs without rebuilding.
// Used for ablation testing — disable individual features to measure their contribution.

export const FEATURE_TOGGLES = {
  owaspMapping: true,          // deterministic keyword OWASP classification
  aiAnalysis: true,            // Gemini LLM enrichment
  hallucinationGuard: false,    // post-AI validation layer
  contextualWeighting: true,   // Extension 4 exploitability multipliers
  deltaComparison: true,       // scan-to-scan comparison
}

/** Returns a frozen snapshot of current toggle states for embedding in scan JSON. */
export function getToggleSnapshot(): typeof FEATURE_TOGGLES {
  return { ...FEATURE_TOGGLES }
}
