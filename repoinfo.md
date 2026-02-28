# PurpleTeam Suite — How It Works

## Overview

PurpleTeam Suite is a desktop security scanning application built with Electron + React + TypeScript. It orchestrates an automated vulnerability assessment pipeline: scan a target website with Nmap, parse the raw results into structured data, categorise findings against the OWASP Top 10, score the target's security posture, enrich everything with AI-generated plain-English explanations via Google Gemini, validate the AI's output for hallucinations, and generate professional exportable reports.

The app is modular — each stage of the pipeline is an independent module with its own folder, types, and barrel export. Modules communicate through Electron's IPC (Inter-Process Communication) bridge, keeping the UI isolated from backend logic for security.

---

## The Pipeline

Every scan follows this linear pipeline. Each module's output becomes the next module's input.

```
Target → Validate → Phase 1 Scan → Parse XML → Phase 2 Scan → Parse XML → Merge
  → OWASP Map → Security Score → AI Analysis → Hallucination Guard → Report
```

| Stage                  | Module   | Input                        | Output                                      |
| ---------------------- | -------- | ---------------------------- | ------------------------------------------- |
| 1. Validate            | Scanner  | User-entered URL             | Allowed/denied (checked against allowlist)  |
| 2. Phase 1 Scan        | Scanner  | Target URL                   | Raw XML (top 100 ports, ~2-4 min)           |
| 3. Parse               | Scanner  | Raw XML                      | Structured JSON (ports, services, vulns)    |
| 4. Phase 2 Scan        | Scanner  | Target URL                   | Raw XML (all 65,535 ports, ~10-25 min)      |
| 5. Merge               | Scanner  | Phase 1 + Phase 2 JSON       | Deduplicated combined results               |
| 6. OWASP Map           | Analysis | Vulnerability list           | Each vuln tagged to OWASP Top 10 category   |
| 7. Score               | Analysis | Vuln counts + OWASP coverage | 0-100 score with letter grade               |
| 8. AI Analysis         | LLM      | Compressed vuln data         | Plain-English summaries + remediation steps |
| 9. Hallucination Guard | Analysis | AI output + scan data        | Trust score + per-vuln risk flags           |
| 10. Report             | Reports  | All above combined           | Exportable PDF report                       |

---

## targets

testphp.vulnweb.com
localhost
https://demo.testfire.net/

---

## Module Breakdown

### 1. Scanner Module — `electron/scanner/`

Orchestrates Nmap and converts its output into usable data.

| File        | Role                                                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nmap.ts`   | Finds Nmap on the system, spawns it as a child process, runs the 2-phase progressive scan, merges results, saves JSON to disk                                         |
| `parser.ts` | Parses Nmap's XML output into typed JSON using `xml2js`; filters non-vuln scripts, extracts CVEs via regex, determines severity from CVSS scores and pattern matching |
| `types.ts`  | Type definitions: `NmapScanData`, `PortResult`, `VulnerabilityResult`, `ScanResult`                                                                                   |
| `index.ts`  | Barrel export                                                                                                                                                         |

**Key features:**

- **Progressive 2-phase scan** — Phase 1 (quick, top 100 ports) returns early results while Phase 2 (full 65,535 ports) runs in background
- **Live progress streaming** — every line of Nmap stdout is pushed to the UI in real-time via IPC
- **Post-processing detection** — parser adds vulnerabilities for missing security headers (X-Frame-Options, CSP, HSTS, X-Content-Type-Options) and HTTP-only sites (no HTTPS)
- **Severity from CVSS** — `vulners` script output is parsed for CVSS scores and mapped to severity thresholds (critical ≥9.0, high ≥7.0, medium ≥4.0, low ≥0.1)
- **Negative result filtering** — output containing "not vulnerable", "no vulnerabilities found", etc. is automatically discarded
- **Target allowlist** — `allowed-targets.json` restricts scanning to approved targets only (testphp.vulnweb.com, localhost, 127.0.0.1, ::1)
- **Abort support** — running scan can be killed mid-execution
- **Scan history** — JSON files persisted in `data/scans/` with ISO timestamps
- **Target normalisation** — `normalizeTarget()` strips URL schemes (`http://`, `https://`), paths, and query strings, extracting a bare hostname for Nmap. Explicit ports in the URL (e.g. `localhost:8080`) are extracted and passed as `-p {port},1-1000` to ensure coverage
- **Windows localhost support** — Nmap's default SYN scan (`-sS`) fails on the Windows loopback adapter. When the target resolves to localhost/127.0.0.1/::1 on Windows, the scanner automatically switches to TCP connect scan (`-sT`)
- **Grouped scan history** — `groupScansByTarget()` groups all saved scans by normalised target URL, returning newest-first ordering with latest score and grade for sidebar display

---

### 2. Analysis Module — `electron/analysis/`

Pure computation — no external calls. Categorises, scores, and compares scan results deterministically.

| File                     | Role                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `owasp-types.ts`         | Enum of 10 OWASP categories (A01–A10), each with name, description, keyword list, and CVE patterns                                            |
| `owasp-mapper.ts`        | Maps each vulnerability to OWASP categories via keyword matching across title, description, CVE, service, and output fields                   |
| `security-scorer.ts`     | Calculates 0-100 security score with grade, confidence level, breakdown, and recommendations                                                  |
| `hallucination-guard.ts` | Cross-validates AI output against deterministic scan data; flags potential hallucinations                                                     |
| `delta-types.ts`         | Type definitions for the delta comparison system: `ScanDelta`, `ScanDeltaChain`, `TargetGroup`, `OWASPDeltaEntry`, `VulnerabilityFingerprint` |
| `delta-comparison.ts`    | Delta comparison engine — computes resolved/new/persisting vulns between sequential scans of the same target                                  |
| `index.ts`               | Barrel export                                                                                                                                 |

**OWASP Mapping features:**

- **Multi-field keyword search** — matches against title + description + CVE + service + output combined
- **Confidence tiers** — high (3+ keyword hits), medium (2), low (1)
- **Regex special-cases** — SQL injection, XSS, path traversal, and weak SSL/TLS have dedicated regex rules that override keyword matching
- **Fallback chain** — unmatched vuln with CVE → A06 (Vulnerable Components); no match at all → A05 (Security Misconfiguration)
- **Sorted output** — mappings returned in descending confidence order

**Security Scoring features:**

- **Weighted severity deductions** — critical: −20, high: −10, medium: −5, low: −2, info: −1
- **OWASP breadth penalty** — −5 per OWASP category found (wide attack surface = worse)
- **Remediation bonus** — +10 if LLM analysis exists (indicates full pipeline completion)
- **Separate confidence calculation** — high score with low confidence means "scanner couldn't find much", not "target is secure"
- **Confidence logic** — no open ports = low; web services + zero vulns = low (scanner likely missed things); ≥5 vulns = high
- **Contextual recommendations** — generated based on vuln counts, OWASP coverage width, and scan confidence

**Delta Comparison features:**

- **Vulnerability fingerprinting** — generates stable identity keys for vulnerabilities across scans using CVE + port (preferred) or script + title + port (fallback). This ensures the same finding in two different scans is recognised as the same vulnerability even though counter-based IDs differ
- **Three-way classification** — each vulnerability is classified as _resolved_ (in older scan only), _new_ (in newer scan only), or _persisting_ (in both scans)
- **Score change tracking** — calculates the difference in security score between the two scans with directional labelling (improved/degraded/unchanged)
- **OWASP coverage delta** — computes per-category change in vulnerability count across the OWASP Top 10 between the two scans. Negative values indicate remediation progress; positive values indicate regressions
- **Delta chain computation** — `computeAllDeltas()` takes a list of scans for one target and produces a chain of pairwise comparisons (each consecutive pair), enabling lifecycle tracking across multiple assessment cycles
- **Target grouping** — `groupScansByTarget()` aggregates all saved scans by target URL, sorted newest-first, with latest score/grade metadata for the sidebar

---

### 3. LLM Module — `electron/llm/`

Sends vulnerability data to Google Gemini and parses structured analysis back.

| File        | Role                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------ |
| `gemini.ts` | API client — builds prompts, calls Gemini with retry logic, parses JSON responses          |
| `types.ts`  | Request/response types: `LLMAnalysisRequest`, `VulnerabilityAnalysis`, `LLMAnalysisResult` |
| `index.ts`  | Barrel export                                                                              |

**Key features:**

- **Model cascade** — primary: `gemini-2.0-flash`, fallback: `gemini-2.0-flash-lite` (if primary fails, automatically retries on fallback)
- **Data compression** — only essential fields sent to API (id, name, severity, port, description capped at 500 chars, evidence at 200)
- **Structured output enforcement** — prompt demands JSON-only response in a specific schema; parser strips markdown code blocks if AI wraps output
- **Low temperature** — `0.2` for deterministic, factual responses (minimises creative hallucination)
- **Retry with backoff** — 2 retries with 1s/5s delays; rate-limit errors (429) get longer waits
- **30s timeout** — per request, prevents hanging
- **Per-vulnerability analysis** — each vuln gets: plain English summary (2-3 sentences), affected endpoints, severity justification, 3 remediation steps, OWASP category, confidence score (0-1)
- **Missing analysis detection** — warns if any vulnerability ID from the request is missing from the response

#### Anti-Hallucination Features

The app has multiple layers designed to detect and mitigate AI hallucinations (fabricated information):

**Built-in safeguards (always active):**

| Feature                           | What it does                                                                                                                                              | Where                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Keyword-first OWASP mapping**   | Deterministic keyword matching categorises vulns BEFORE the AI sees them. The AI's output is compared against this ground truth — it can't override facts | `owasp-mapper.ts`                          |
| **Structured output constraints** | AI must respond in a fixed JSON schema with typed enums. It cannot invent OWASP categories that don't exist in the A01-A10 enum                           | `gemini.ts` prompt + `owasp-types.ts`      |
| **Low temperature (0.2)**         | Reduces randomness/creativity in AI responses, forcing more deterministic output                                                                          | `gemini.ts` generationConfig               |
| **Data compression**              | Only scan-verified data is sent to the AI. It can only analyse what the scanner actually found, not speculate about unseen systems                        | `gemini.ts` buildPrompt()                  |
| **Confidence levels on mappings** | Every OWASP mapping has a confidence score (high/medium/low) and a reason string explaining WHY it was categorised that way                               | `owasp-types.ts` OWASPMapping interface    |
| **Separate scan confidence**      | The security score includes a scan confidence rating that warns when the scanner found suspiciously little — preventing false "A+ secure" ratings         | `security-scorer.ts` calculateConfidence() |

**Hallucination Guard (post-AI validation layer):**

| Feature                 | What it catches                                                                                                         | Risk level assigned                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Cross-validation**    | AI assigns OWASP category X but keyword matching says category Y. Flags the disagreement with both sides shown          | Medium if 1 conflict, High if 2+                       |
| **CVE verification**    | AI mentions CVE-2024-XXXXX in its explanation but that CVE was never in the scan data. Likely fabricated                | High (invented CVEs are a strong hallucination signal) |
| **Confidence mismatch** | AI reports 0.9 confidence but the keyword matcher only has low confidence for the same vuln. Suspiciously overconfident | Medium                                                 |
| **Missing remediation** | AI returns empty remediation steps — suggests it couldn't actually analyse the vulnerability meaningfully               | Medium                                                 |

**Output:**

- Per-vulnerability `HallucinationFlag` with risk level (low/medium/high) and list of reasons
- Overall `HallucinationReport` with trust score (0-100), counts by risk level
- Trust score formula: `100 - (highRisk × 25) - (mediumRisk × 10)`
- Logged to console on every analysis run for monitoring

---

### 4. Reports Module — `electron/reports/`

Generates professional PDF reports from the combined pipeline output.

| File                        | Role                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `generator.ts`              | Dark-themed security assessment report (internal review style)                                            |
| `pentest-generator.ts`      | Professional pentest-style report (light-themed, printable, with cover page + ToC)                        |
| `delta-report-generator.ts` | Scan comparison (delta) report — professional LaTeX-styled PDF comparing two sequential scans of a target |
| `types.ts`                  | `ReportOptions`, `ReportResult`, `ReportMetadata`                                                         |
| `index.ts`                  | Barrel export                                                                                             |

**Key features:**

- **Three report styles** — assessment (dark, compact, internal), pentest (light, professional, client-facing with cover page, table of contents, executive summary), and delta comparison (professional, light-themed, comparing two sequential scans)
- **AI analysis inline** — each vulnerability listing includes the LLM's plain-English summary and remediation steps
- **OWASP coverage grid** — visual matrix showing which Top 10 categories were affected
- **Prioritised remediation** — findings sorted by severity (critical first) with step-by-step fixes
- **Export via system dialog** — user picks save location; report opens in default browser
- **Auto-save** — pentest reports and delta reports auto-save to `data/reports/` with structured filenames
- **Report caching** — generated delta PDFs are cached on disk; subsequent views return the cached copy without regeneration
- **Report metadata** — persisted to `data/reports/metadata.json` for history/retrieval

**Delta Comparison Report structure:**

The delta report is a 7-section, multi-page PDF generated from `generateDeltaReportHTML()` with consistent LaTeX-academic styling matching the main pentest report (Palatino Linotype serif body, Segoe UI sans-serif labels, muted pastel severity badges, white background, small-caps section headers):

1. **Cover page** — target name, score change summary, baseline/latest dates, double-border professional framing
2. **Table of Contents** — numbered sections with small-caps headings
3. **Executive Summary** — narrative overview with key findings info-box, summary table (resolved/new/persisting counts with severity breakdowns)
4. **Score Comparison** — side-by-side baseline vs latest metrics table with directional commentary
5. **Resolved Vulnerabilities** — findings table + detailed finding cards for vulnerabilities no longer detected
6. **New Vulnerabilities** — findings table + detailed finding cards for newly introduced findings
7. **Persisting Vulnerabilities** — findings table + detailed finding cards for unaddressed findings
8. **OWASP Top 10 Coverage Delta** — per-category table showing count changes (conditional, only shown if OWASP data exists)
9. **Conclusion** — auto-generated narrative based on score direction and remaining findings

---

## Frontend (UI) — `src/`

| File / Folder                        | Role                                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `App.tsx`                            | React Router: `/scan`, `/dashboard`, `/reports`                                                                                        |
| `pages/ScanTarget.tsx`               | Target input, validation, 6-step progress stepper, live terminal, scan lifecycle                                                       |
| `pages/Dashboard.tsx`                | Scan history sidebar, vulnerability table (search/sort), score card, OWASP matrix, AI analysis display, delta comparison summary cards |
| `pages/Reports.tsx`                  | Target-grouped sidebar with interleaved scan entries and inline comparison links, report generation, PDF preview, export               |
| `components/Layout.tsx`              | App shell — collapsible sidebar nav, header, status indicator                                                                          |
| `components/SecurityScoreCard.tsx`   | Score circle (0-100), letter grade, confidence, breakdown, recommendations                                                             |
| `components/OWASPCoverageMatrix.tsx` | 5×2 grid of OWASP categories with hit counts and tooltips                                                                              |
| `components/ReportViewer.tsx`        | In-app report renderer with score, OWASP grid, ports, vulns with AI inline                                                             |
| `lib/scanStore.ts`                   | Global singleton state store (in-memory, persists across page navigation)                                                              |
| `lib/useScanStore.ts`                | React hook wrapping scanStore with useState/useEffect subscription                                                                     |
| `types/electron.d.ts`                | TypeScript declarations for entire `window.electronAPI` interface                                                                      |
| `types/delta.ts`                     | Frontend mirror of delta types: `ScanDelta`, `ScanDeltaChain`, `TargetGroup`, `OWASPDeltaEntry`                                        |

---

## IPC Bridge — `electron/preload.ts`

All communication between frontend and backend goes through `contextBridge.exposeInMainWorld('electronAPI', ...)`. The UI calls `window.electronAPI.scanner.runNmap()`, which internally calls `ipcRenderer.invoke('scanner:run-nmap')`, which triggers the registered `ipcMain.handle(...)` in `main.ts`.

**Security model:** `contextIsolation: true`, `nodeIntegration: false` — the UI cannot access the file system or run programs directly. Only pre-approved IPC channels are exposed.

| Channel                       | Direction    | Purpose                               |
| ----------------------------- | ------------ | ------------------------------------- |
| `scanner:run-nmap`            | UI → Backend | Start a scan                          |
| `scanner:validate-target`     | UI → Backend | Check allowlist                       |
| `scanner:get-history`         | UI → Backend | Load past scans                       |
| `scanner:abort`               | UI → Backend | Kill running scan                     |
| `scanner:delete-scan`         | UI → Backend | Remove saved scan                     |
| `scanner:progress`            | Backend → UI | Live scan output lines                |
| `scanner:phase-result`        | Backend → UI | Phase 1 early results                 |
| `llm:analyze-vulnerabilities` | UI → Backend | Send vulns to Gemini AI               |
| `report:export`               | UI → Backend | Save assessment report                |
| `report:export-pentest`       | UI → Backend | Save pentest report                   |
| `report:generate-pentest`     | UI → Backend | Generate pentest report               |
| `report:get-history`          | UI → Backend | Load past reports                     |
| `report:open`                 | UI → Backend | Open saved report                     |
| `report:delete`               | UI → Backend | Delete a report                       |
| `report:open-file`            | UI → Backend | Open file in browser                  |
| `scanner:get-grouped-history` | UI → Backend | Load scans grouped by target          |
| `scanner:get-deltas`          | UI → Backend | Compute delta chain for a target      |
| `report:generate-delta`       | UI → Backend | Generate comparison PDF               |
| `report:export-delta`         | UI → Backend | Export comparison PDF via save dialog |

---

## Data Storage

| What                  | Where                                                | Format               |
| --------------------- | ---------------------------------------------------- | -------------------- |
| Scan results (raw)    | `data/scans/scan-{timestamp}.xml`                    | Nmap XML             |
| Scan results (parsed) | `data/scans/scan-{timestamp}.json`                   | Structured JSON      |
| Generated reports     | `data/reports/report_{target}_{date}.pdf`            | PDF                  |
| Delta comparison PDFs | `data/reports/delta_{target}_{older}_to_{newer}.pdf` | PDF                  |
| Report metadata       | `data/reports/metadata.json`                         | JSON                 |
| Target allowlist      | `allowed-targets.json`                               | JSON                 |
| API key               | `.env`                                               | `GEMINI_API_KEY=...` |

---

## Tech Stack

| Layer             | Technology                           |
| ----------------- | ------------------------------------ |
| Desktop framework | Electron                             |
| Frontend          | React 19 + TypeScript                |
| Styling           | Tailwind CSS (dark brutalist theme)  |
| Build tool        | Vite                                 |
| Scanning          | Nmap (external, installed on host)   |
| AI                | Google Gemini 2.0 Flash API          |
| XML parsing       | xml2js                               |
| Routing           | React Router                         |
| State             | Custom singleton store + React hooks |

---

## Localhost Test Site — `test-site/`

A controlled vulnerable web application used for testing the delta comparison feature. Since external targets (e.g. testphp.vulnweb.com) don't change between scans, this local server provides intentionally introduced vulnerabilities that can be selectively remediated between scan cycles.

| File              | Role                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `server.js`       | Express server with 12 intentional vulnerabilities (partially remediated for testing)               |
| `server-fixed.js` | Fully remediated version of the server with all vulnerabilities addressed                           |
| `public/`         | Static assets: HTML pages, fake `.git/` directory, `config.bak`, `robots.txt`, `uploads/` directory |
| `package.json`    | Dependencies (Express, cookie-parser)                                                               |

**Intentional vulnerabilities introduced:**

| #   | Vulnerability                | Category | Detection Method                                |
| --- | ---------------------------- | -------- | ----------------------------------------------- |
| 1   | Missing security headers     | A05      | http-security-headers NSE script                |
| 2   | No HTTPS / TLS               | A02      | Post-processing detection in parser             |
| 3   | Missing CSRF protection      | A01      | http-csrf NSE script                            |
| 4   | Reflected XSS                | A03      | http-stored-xss / http-dombased-xss NSE scripts |
| 5   | DOM-based XSS                | A03      | http-dombased-xss NSE script                    |
| 6   | Insecure cookies             | A02      | http-cookie-flags NSE script                    |
| 7   | Exposed `.git` directory     | A05      | http-git NSE script                             |
| 8   | Directory listing enabled    | A01      | http-ls NSE script                              |
| 9   | Open redirect                | A01      | http-open-redirect NSE script                   |
| 10  | Backup file exposure         | A05      | http-backup-finder NSE script                   |
| 11  | Overly permissive robots.txt | A05      | http-robots.txt NSE script                      |
| 12  | Basic admin panel            | A07      | http-auth-finder NSE script                     |

The workflow for delta testing: start `server.js` → scan → fix selected vulnerabilities → rescan → compare the two scans to observe score changes, resolved/new/persisting classifications, and OWASP delta output.

---

## Reports Page — UI Architecture

The Reports page (`Reports.tsx`) provides a target-grouped sidebar with inline delta comparison support:

- **Target groups** — scans are grouped by target URL in the sidebar, each group expandable to show individual scans
- **Interleaved layout** — within each group, scan entries alternate with comparison links. After each scan entry, a comparison link to the next older scan is shown inline (e.g. "Scan 3 → Latest")
- **View modes** — two modes: `full` (single scan pentest report) and `comparison` (delta report between two scans)
- **No-change detection** — comparisons with zero differences display an inline "No changes" indicator instead of a clickable link
- **Score trend indicators** — each comparison link shows resolved/new/persisting counts and a directional score arrow (↑/↓/→) with colour coding
- **PDF preview** — selected reports render as embedded PDFs in the main content area via Blob URLs
- **Context menu** — right-click on any scan entry to delete it; the sidebar automatically resets selection if the deleted scan was being viewed

---

# Planned / In-Progress Implementation Extensions

The following extensions are designed to strengthen lifecycle integration, validation robustness, and empirical evaluation capabilities within the PurpleTeam Suite.

### 1. Iterative Scan Delta Comparison — ✅ IMPLEMENTED

The system supports structured comparison between consecutive scans of the same target.

After a new scan completes:

- The most recent previous scan for that target is loaded.
- Vulnerabilities are categorised as: **Resolved**, **Persisting**, **Newly introduced**.
- Security score changes are calculated (previous vs current).
- OWASP category coverage differences are computed.
- A structured Change Summary is generated and viewable in both the dashboard and exported reports.
- A professional PDF comparison report can be generated and exported.

This introduces lifecycle iteration and measurable post-remediation reassessment.

### 2. Controlled Evaluation Scenario (Localhost Testbed) — ✅ IMPLEMENTED

A controlled local environment (`test-site/`) is used to:

- Introduce known vulnerabilities (12 intentional findings).
- Perform initial assessment.
- Remediate selected vulnerabilities.
- Re-scan and measure: score improvement, vulnerability reduction, OWASP coverage contraction, delta comparison output.

This supports empirical evaluation of prioritisation, remediation guidance, and scoring behaviour.

### 3. Empirical Hallucination Evaluation Layer — ✅ IMPLEMENTED

Every time the LLM analyses vulnerabilities, the hallucination guard logs structured metrics to `data/hallucination-metrics.json` — a longitudinal dataset tracking AI reliability across scans.

**Metrics tracked per scan:**

| Metric                              | What it measures                                                              | How it's calculated                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `owaspDisagreementRate`             | How often AI's OWASP category differs from deterministic keyword matching     | disagreement count / total analyzed                                                     |
| `owaspDisagreementCount`            | Vulnerabilities where AI category ≠ keyword-matched category                  | Count of cross-validation failures                                                      |
| `fabricatedCVECount`                | CVE references in AI output not found in scan data                            | Count of invented CVE strings                                                           |
| `confidenceMismatchRate`            | How often AI-to-keyword confidence gap exceeds 0.5                            | mismatch count / total analyzed                                                         |
| `trustScore`                        | Overall reliability rating (0-100)                                            | `100 - (fabricatedCVEs × 50) - (owaspDisagreements × 5) - (confidenceMismatches × 3)` |
| `totalAnalysed`                     | Vulnerabilities processed in this scan                                        | Count of LLM analyses returned                                                          |
| `lowRisk`, `mediumRisk`, `highRisk` | Vulnerability counts by hallucination risk level                              | Severity of detected hallucination flags                                                |

**Technical implementation:**

- **Module:** `frontend/electron/analysis/hallucination-metrics.ts`
- **API:** `window.electronAPI.hallucination.getMetricsHistory()` returns all saved entries
- **Persistence:** IPC handler in `main.ts` appends metrics after every LLM analysis; results also embedded under `llmAnalysis.hallucinationReport` in each scan JSON
- **Model:** `gemini-2.5-flash` (primary) with 4-model fallback chain; 120s timeout; 16,384 max output tokens (~50 vulns per request); dual API key rotation
- **Batch scaling:** For 50+ vulnerabilities (e.g. future Nikto/ZAP integration), chunk into batches of 30 in `analyzeVulnerabilities()` — transparent to the renderer

### 3.5 Refining Hallucination Metrics — Improving Trust Scores — ✅ IMPLEMENTED

Trust scores were consistently low (0–65) not because the AI was unreliable, but because the validators were too simplistic and the AI categorised differently than keyword matching. Four strategies were implemented to close the gap between AI judgement and validator logic without weakening the safety net.

**Problem:** The metrics measure TOOL reliability (AI vs validators agreement), not target security. Low scores meant the AI and validators disagreed on OWASP labelling, confidence levels, or both — triggering excessive false flags.

**Root causes addressed:**

1. **OWASP disagreement (was ~62-100%)** — Limited keyword vocabulary meant the matcher fell back to A05 for vulns the AI correctly categorised elsewhere (CSRF → A01, outdated software → A06, missing headers → A05 vs A02)
2. **Confidence mismatch (was ~37-76%)** — Binary check (`AI > 0.8 && keywords === 'low'`) flagged obvious vulns where the AI was rightfully confident but the matcher only found 1 keyword
3. **Punitive formula** — `100 - (highRisk × 25) - (mediumRisk × 10)` hit 0 quickly with even moderate disagreement rates

**What was implemented:**

**Strategy 1 — Smarter OWASP validators** (`owasp-types.ts`, `owasp-mapper.ts`):
- Expanded keyword vocabulary across 6 OWASP categories (A01, A02, A03, A05, A06, A07) — added CSRF, HSTS, clickjacking, cookie flags, CORS, named TLS attacks (POODLE, BEAST, Heartbleed), template injection, RCE, log4shell, MFA/2FA terms, and ~60 more keywords
- Replaced simple count-based confidence (`3+ hits = high`) with weighted keyword scoring — specific terms like `sql injection` score 10, generic terms like `ssl` score 2, thresholds: total weight ≥ 10 = high, ≥ 5 = medium
- Added 6 context-aware regex rules: missing HTTP headers → A05, CSRF → A01, information disclosure → A01, cookie security → A05, outdated software → A06

**Strategy 2 — AI prompt alignment** (`gemini.ts`):
- Added explicit OWASP categorisation rules to the Gemini `buildPrompt()` function, mapping vulnerability types to specific OWASP categories (e.g., "CSRF, information disclosure → A01", "missing HTTP headers, cookie flags → A05")
- Standardises AI labelling to match deterministic validators without compromising analysis quality

**Strategy 3 — Scaled confidence comparison** (`hallucination-guard.ts`):
- Replaced binary mismatch check with proportional comparison: keyword confidence maps to numeric values (high = 0.9, medium = 0.6, low = 0.3)
- Only flags when the gap exceeds 0.5 (e.g., AI says 0.9 but keywords say 0.3), eliminating false positives where AI is rightfully confident

**Strategy 4 — Weighted trust score formula** (`hallucination-guard.ts`):
- Replaced flat `100 - (highRisk × 25) - (mediumRisk × 10)` with check-type-weighted scoring:
  - Fabricated CVEs: −50 pts each (genuinely dangerous — hardcoded data is wrong)
  - OWASP disagreements: −5 pts each (subjective labelling difference)
  - Confidence mismatches: −3 pts each (least concerning — both sides might be right)

**Target metrics:**

- OWASP disagreement rate ≤ 20% (down from 62-100%)
- Confidence mismatch rate ≤ 15% (down from 37-76%)
- Trust score ≥ 70 on repeat scans of the same target
- Fabricated CVE count remains at 0 (this check was never weakened)

### 4. Exploitability-Aware Risk Weighting

The security scoring engine will incorporate contextual exploitability factors:

- Public-facing port exposure weighting
- Database/service exposure amplification
- TLS absence penalty
- Authentication weakness multipliers

All adjustments will remain deterministic and transparent, strengthening prioritisation realism without introducing probabilistic instability.
