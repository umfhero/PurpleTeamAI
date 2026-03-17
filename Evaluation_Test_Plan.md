# PurpleTeam Suite — Evaluation Test Plan for Chapter 4

## Purpose

This document defines every test needed to produce the empirical data for Chapter 4 (Analysis & Results). It includes ablation tests (toggling features off to show their individual contribution), lifecycle tests (scan-remediate-rescan), and reliability tests (hallucination metrics).

**Important**: You deleted old scan history. That is fine. The controlled testbed (`test-site/`) is reproducible and the external targets are live. All data collection starts fresh from this point. What matters is that you run each test methodically, save every JSON output, and record results in the tables provided at the end.

---

## Pre-Requisite: Feature Toggle System

Before running tests, you need a lightweight toggle system so you can disable individual features and re-process the same scan data. This avoids re-scanning (which wastes time and introduces variability on live targets).

### Implementation Prompt for Your AI Agent

```
Add a feature toggle configuration to the PurpleTeam Suite analysis pipeline.

Create a new file: `frontend/electron/analysis/feature-toggles.ts`

It should export a single object:

export const FEATURE_TOGGLES = {
  owaspMapping: true,          // deterministic keyword OWASP classification
  aiAnalysis: true,            // Gemini LLM enrichment
  hallucinationGuard: true,    // post-AI validation layer
  contextualWeighting: true,   // Extension 4 exploitability multipliers
  deltaComparison: true,       // scan-to-scan comparison
};

Then wire each toggle into the pipeline:

1. In `security-scorer.ts`:
   - If `contextualWeighting === false`, skip all multiplier logic and use
     flat base deductions only (the original scoring behaviour).
   - The score result should include a field `contextualWeightingEnabled: boolean`
     so the output JSON records which mode produced the score.

2. In `owasp-mapper.ts`:
   - If `owaspMapping === false`, return every vulnerability mapped to A05
     (Security Misconfiguration) with confidence "low" and reason
     "OWASP mapping disabled for ablation test". This simulates having
     no intelligent classification.

3. In the LLM analysis call path (wherever `llm:analyze-vulnerabilities`
   is handled in `main.ts`):
   - If `aiAnalysis === false`, skip the Gemini API call entirely and return
     an empty analysis result. The hallucination guard should also be
     skipped (nothing to validate). The score should NOT get the +10
     remediation bonus.

4. In `hallucination-guard.ts`:
   - If `hallucinationGuard === false`, skip all validation and return a
     neutral report: trust score 100, zero flags across all categories.
     This simulates trusting the AI output without verification.

5. Delta comparison does not need a toggle — it only runs when two scans
   of the same target exist and the user requests a comparison.

CRITICAL RULES:
- Toggles must be read at runtime from the exported object (not
  compiled-in constants) so they can be changed between runs without
  rebuilding.
- Every scan JSON saved to `data/scans/` must include a
  `featureToggles` snapshot recording which toggles were active when
  that scan was processed. This makes each result self-documenting.
- Do NOT modify the scanner module (Nmap execution). Scanning always
  runs fully. Toggles only affect post-scan processing.
- Do NOT modify `hallucination-metrics.ts` persistence. If the guard
  is disabled, simply do not append to the metrics file.
```

---

## Test Sequence

Run these in order. Each test group builds on the previous one.

---

### PHASE 1: BASELINE SCANS (All features ON except Extension 4)

These establish your "before Extension 4" baselines. Run these BEFORE implementing Extension 4.

| Test ID | Target                                   | Feature State     | What to Save                                                                |
| ------- | ---------------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| B1      | localhost (testbed, all 12 vulns active) | All ON, Ext 4 OFF | Scan JSON, score, OWASP map, hallucination metrics, screenshot of dashboard |
| B2      | localhost (testbed, all 12 vulns active) | All ON, Ext 4 OFF | Second scan of same state — confirms result consistency                     |
| B3      | testphp.vulnweb.com                      | All ON, Ext 4 OFF | Scan JSON, score, OWASP map, hallucination metrics                          |
| B4      | testphp.vulnweb.com                      | All ON, Ext 4 OFF | Second scan — confirms consistency on external target                       |

**What to record from B1–B4:**

- Security score (number + letter grade)
- Vulnerability count by severity (critical/high/medium/low/info)
- OWASP categories hit (list which A01–A10 appeared)
- Hallucination metrics: trust score, OWASP disagreement rate, confidence mismatch rate, fabricated CVE count
- Scan confidence level (high/medium/low)
- Number of open ports detected

**Why B2 and B4 exist**: You had inconsistency problems before. Running each target twice with identical conditions proves the pipeline now produces stable results. If B1 ≈ B2 and B3 ≈ B4, that is itself a result worth reporting in Chapter 4.

---

### PHASE 2: EXTENSION 4 IMPLEMENTATION + COMPARATIVE SCANS

Implement Extension 4 (contextual weighting), then re-scan.

| Test ID | Target                                   | Feature State    | What to Save                                    |
| ------- | ---------------------------------------- | ---------------- | ----------------------------------------------- |
| E1      | localhost (testbed, all 12 vulns active) | All ON, Ext 4 ON | Scan JSON, score, contextualWeighting breakdown |
| E2      | testphp.vulnweb.com                      | All ON, Ext 4 ON | Scan JSON, score, contextualWeighting breakdown |

**What to record from E1–E2:**

- Everything from Phase 1, PLUS:
- Per-vulnerability contextual factors (portExposure, serviceExposure, authWeakness multipliers)
- Whether TLS absence penalty applied (true/false)
- Total base deductions vs total adjusted deductions
- Score difference: B1 score minus E1 score = impact of contextual weighting
- Which specific vulnerabilities were most affected and why

**Key comparison for Chapter 4:**

| Metric                   | B1 (Flat) | E1 (Weighted) | Delta |
| ------------------------ | --------- | ------------- | ----- |
| Score                    | ?         | ?             | ?     |
| Highest single deduction | ?         | ?             | ?     |
| TLS penalty applied      | N/A       | ?             | —     |

---

### PHASE 3: ABLATION TESTS (Feature-Off Comparisons)

These use the feature toggle system. You do NOT need to re-scan — you reprocess the same scan data with features toggled off. However, since the toggles affect pipeline processing that happens during scanning, the simplest approach is to change the toggle, run a new scan, and save the result. Use **localhost testbed only** (controlled, reproducible) for all ablation tests.

#### Test 3A: No OWASP Mapping (Classification Contribution)

| Test ID | Toggle Changed                        | Expected Effect                                                                                                                                                                                                                                         |
| ------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1      | `owaspMapping: false` (all others ON) | Every vuln falls to A05. OWASP breadth penalty drops to −5 (one category). Score increases because breadth penalty shrinks. Hallucination guard disagreement rate may spike (AI still classifies properly but keyword matcher says A05 for everything). |

**What to record:**

- Score with vs without OWASP mapping (E1 vs A1)
- OWASP category distribution: E1 shows spread across categories, A1 shows everything in A05
- Hallucination guard trust score change (demonstrates that the cross-validation layer detects when classification is degraded)

**Chapter 4 argument**: The deterministic OWASP mapper provides meaningful vulnerability triage. Without it, the system cannot differentiate between vulnerability classes, and the breadth penalty loses its function as a risk surface indicator.

#### Test 3B: No AI Analysis (LLM Enrichment Contribution)

| Test ID | Toggle Changed                      | Expected Effect                                                                                                                                                                 |
| ------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A2      | `aiAnalysis: false` (all others ON) | No plain-English summaries, no AI-generated remediation steps, no remediation bonus (+10 lost). Score drops by 10. Reports contain raw scan data only — no actionable guidance. |

**What to record:**

- Score with vs without AI (E1 vs A2) — expect exactly −10 from lost remediation bonus
- Qualitative comparison: pick 3 example vulnerabilities and show the report output with AI (rich explanation + 3 remediation steps) vs without (raw Nmap output only)
- Hallucination metrics file: no new entry appended (guard was skipped)

**Chapter 4 argument**: The LLM enrichment transforms scanner output from technical noise into actionable intelligence. The −10 score penalty for missing analysis is a deliberate design signal that incomplete pipeline runs should not be treated as full assessments.

#### Test 3C: No Hallucination Guard (Validation Contribution)

| Test ID | Toggle Changed                              | Expected Effect                                                                                                                                                           |
| ------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A3      | `hallucinationGuard: false` (all others ON) | AI analysis runs but output is not validated. Trust score is hardcoded to 100. No per-vulnerability risk flags. Any fabricated CVEs or OWASP disagreements go undetected. |

**What to record:**

- Trust score: A3 always reports 100 (meaningless). E1 reports the real validated score.
- Count of hallucination flags that E1 caught but A3 would have missed
- If any fabricated CVEs existed in E1, highlight that A3 would have passed them through unchallenged

**Chapter 4 argument**: The hallucination guard is a safety net. Without it, the system would present AI output as fact without verification. Even when the AI performs well (low flag count), the guard's presence is what makes the system's AI claims trustworthy.

#### Test 3D: No Contextual Weighting (Extension 4 Contribution)

| Test ID | Toggle Changed                               | Expected Effect                                                                                                                                     |
| ------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| A4      | `contextualWeighting: false` (all others ON) | Flat severity deductions only. All vulns treated equally regardless of port, service, or auth context. Score rises because multipliers are removed. |

**What to record:**

- This is effectively the B1 vs E1 comparison again, but now captured within the toggle framework so the `featureToggles` snapshot in the JSON proves the conditions

**Chapter 4 argument**: Static severity-only scoring fails to reflect real-world exploitability. A medium-severity vulnerability on an exposed database port is operationally more dangerous than the same severity on an obscure internal service.

---

### PHASE 4: LIFECYCLE TEST (Delta Comparison + Remediation Cycle)

This demonstrates the purple team lifecycle loop. Uses localhost testbed only.

| Test ID | Step         | What to Do                                                                                              |
| ------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| L1      | Initial scan | Scan localhost with all 12 vulns active, all features ON (including Ext 4). Save JSON.                  |
| L2      | Remediate    | Fix 4–6 of the 12 known vulnerabilities in `test-site/`. Document exactly which ones you fixed and how. |
| L3      | Re-scan      | Scan localhost again. Save JSON.                                                                        |
| L4      | Delta report | Generate delta comparison report (L1 → L3). Export the PDF.                                             |

**What to record:**

- L1 score vs L3 score (score should improve)
- Resolved vulnerability count (should match the ones you fixed)
- Persisting vulnerability count (should match the ones you left)
- New vulnerability count (should be 0 unless your fixes introduced something)
- OWASP coverage change (categories should shrink if you cleared entire categories)
- The delta comparison PDF itself — this is a direct artefact for Chapter 4 / appendix

**Chapter 4 argument**: The system supports iterative assessment. Remediation efforts produce measurable score improvements, and the delta comparison provides auditable evidence of progress.

---

### PHASE 5: HALLUCINATION RELIABILITY OVER TIME

Run 3–5 scans across different targets with all features ON (including Ext 4). The hallucination metrics file accumulates longitudinal data.

| Test ID | Target                               | Purpose                                                     |
| ------- | ------------------------------------ | ----------------------------------------------------------- |
| H1      | localhost                            | Accumulate metrics entry                                    |
| H2      | testphp.vulnweb.com                  | Accumulate metrics entry                                    |
| H3      | Mutillidae                           | Accumulate metrics entry (new target, tests generalisation) |
| H4      | localhost (post-remediation from L3) | Accumulate metrics entry                                    |

**What to record from `data/hallucination-metrics.json`:**

- Trust score per scan (target: ≥70)
- OWASP disagreement rate per scan (target: ≤20%)
- Confidence mismatch rate per scan (target: ≤15%)
- Fabricated CVE count per scan (target: 0)
- Total analysed per scan

**Chapter 4 argument**: Present this as a table or chart showing trust score stability across targets and scans. If all scans meet the targets from Extension 3.5, the refinement strategy is validated. If some do not, that is honest evaluation data showing where the approach has limits.

---

## Results Recording Templates

Copy these tables into a spreadsheet or document and fill them in as you run each test. These become your raw data for Chapter 4.

### Table 1: Scan Result Summary

| Test ID | Date | Target    | Score | Grade | Vulns (C/H/M/L/I) | OWASP Cats Hit | Confidence | Trust Score | Ext 4 Active | Feature Toggles |
| ------- | ---- | --------- | ----- | ----- | ----------------- | -------------- | ---------- | ----------- | ------------ | --------------- |
| B1      |      | localhost |       |       |                   |                |            |             | No           | all on          |
| B2      |      | localhost |       |       |                   |                |            |             | No           | all on          |
| B3      |      | vulnweb   |       |       |                   |                |            |             | No           | all on          |
| B4      |      | vulnweb   |       |       |                   |                |            |             | No           | all on          |
| E1      |      | localhost |       |       |                   |                |            |             | Yes          | all on          |
| E2      |      | vulnweb   |       |       |                   |                |            |             | Yes          | all on          |
| A1      |      | localhost |       |       |                   |                |            |             | Yes          | owasp OFF       |
| A2      |      | localhost |       |       |                   |                |            |             | Yes          | ai OFF          |
| A3      |      | localhost |       |       |                   |                |            |             | Yes          | guard OFF       |
| A4      |      | localhost |       |       |                   |                |            |             | No           | weighting OFF   |

### Table 2: Contextual Weighting Impact (Extension 4)

| Test ID | Base Deductions Total | Adjusted Deductions Total | Difference | TLS Penalty | Highest Multiplied Vuln (name + combined multiplier) |
| ------- | --------------------- | ------------------------- | ---------- | ----------- | ---------------------------------------------------- |
| E1      |                       |                           |            |             |                                                      |
| E2      |                       |                           |            |             |                                                      |

### Table 3: Ablation Score Comparison

| Feature Disabled     | Score With | Score Without | Delta | Key Observation |
| -------------------- | ---------- | ------------- | ----- | --------------- |
| OWASP Mapping        | E1: ?      | A1: ?         | ?     |                 |
| AI Analysis          | E1: ?      | A2: ?         | ?     |                 |
| Hallucination Guard  | E1: ?      | A3: ?         | ?     |                 |
| Contextual Weighting | E1: ?      | A4: ?         | ?     |                 |

### Table 4: Lifecycle Delta (Remediation Cycle)

| Metric           | L1 (Pre-remediation) | L3 (Post-remediation) | Change |
| ---------------- | -------------------- | --------------------- | ------ |
| Score            |                      |                       |        |
| Grade            |                      |                       |        |
| Total vulns      |                      |                       |        |
| Resolved         | —                    |                       |        |
| Persisting       | —                    |                       |        |
| New              | —                    |                       |        |
| OWASP categories |                      |                       |        |

### Table 5: Hallucination Metrics Longitudinal

| Test ID | Target               | Total Analysed | Trust Score | OWASP Disagree % | Confidence Mismatch % | Fabricated CVEs |
| ------- | -------------------- | -------------- | ----------- | ---------------- | --------------------- | --------------- |
| H1      | localhost            |                |             |                  |                       |                 |
| H2      | vulnweb              |                |             |                  |                       |                 |
| H3      | Mutillidae           |                |             |                  |                       |                 |
| H4      | localhost (post-rem) |                |             |                  |                       |                 |

### Table 6: Scan Consistency (B1 vs B2, B3 vs B4)

| Pair     | Score Match? | Vuln Count Match? | OWASP Cats Match? | Discrepancies (if any) |
| -------- | ------------ | ----------------- | ----------------- | ---------------------- |
| B1 vs B2 |              |                   |                   |                        |
| B3 vs B4 |              |                   |                   |                        |

---

## What to Screenshot / Export for Chapter 4

For each test, capture:

1. **Dashboard screenshot** showing score card, OWASP matrix, and vulnerability table
2. **Scan JSON file** saved to `data/scans/` (the raw evidence)
3. **Hallucination metrics JSON** after each AI-enabled scan
4. **Delta comparison PDF** from Phase 4
5. **Console output** showing hallucination guard log (if visible)

Store everything in a folder structure like:

```
evaluation-data/
  phase1-baseline/
    B1/ (JSON + screenshots)
    B2/
    B3/
    B4/
  phase2-extension4/
    E1/
    E2/
  phase3-ablation/
    A1-no-owasp/
    A2-no-ai/
    A3-no-guard/
    A4-no-weighting/
  phase4-lifecycle/
    L1-pre-remediation/
    L2-remediation-notes.md
    L3-post-remediation/
    L4-delta-report.pdf
  phase5-hallucination/
    hallucination-metrics.json (cumulative)
    H1/ H2/ H3/ H4/
```

---

## Order of Operations (Summary)

1. Implement feature toggle system (use the prompt above)
2. Run Phase 1 baseline scans (B1–B4) — BEFORE Extension 4
3. Implement Extension 4 (use `Extension4_Agent_Prompt.md`)
4. Run Phase 2 scans (E1–E2)
5. Run Phase 3 ablation tests (A1–A4)
6. Run Phase 4 lifecycle test (L1–L4)
7. Run Phase 5 hallucination reliability scans (H1–H4)
8. Fill in all results tables
9. Begin writing Chapter 4 using the tables as your evidence base
