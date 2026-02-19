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
| 10. Report             | Reports  | All above combined           | Exportable HTML report                      |

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

---

### 2. Analysis Module — `electron/analysis/`

Pure computation — no external calls. Categorises and scores scan results deterministically.

| File                     | Role                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `owasp-types.ts`         | Enum of 10 OWASP categories (A01–A10), each with name, description, keyword list, and CVE patterns                          |
| `owasp-mapper.ts`        | Maps each vulnerability to OWASP categories via keyword matching across title, description, CVE, service, and output fields |
| `security-scorer.ts`     | Calculates 0-100 security score with grade, confidence level, breakdown, and recommendations                                |
| `hallucination-guard.ts` | Cross-validates AI output against deterministic scan data; flags potential hallucinations                                   |
| `index.ts`               | Barrel export                                                                                                               |

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

Generates professional HTML reports from the combined pipeline output.

| File                   | Role                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `generator.ts`         | Dark-themed security assessment report (internal review style)                     |
| `pentest-generator.ts` | Professional pentest-style report (light-themed, printable, with cover page + ToC) |
| `types.ts`             | `ReportOptions`, `ReportResult`, `ReportMetadata`                                  |
| `index.ts`             | Barrel export                                                                      |

**Key features:**

- **Two report styles** — assessment (dark, compact, internal) and pentest (light, professional, client-facing with cover page, table of contents, executive summary)
- **AI analysis inline** — each vulnerability listing includes the LLM's plain-English summary and remediation steps
- **OWASP coverage grid** — visual matrix showing which Top 10 categories were affected
- **Prioritised remediation** — findings sorted by severity (critical first) with step-by-step fixes
- **Export via system dialog** — user picks save location; report opens in default browser
- **Auto-save** — pentest reports also auto-save to `data/reports/` with structured filenames
- **Report metadata** — persisted to `data/reports/metadata.json` for history/retrieval

---

## Frontend (UI) — `src/`

| File / Folder                        | Role                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `App.tsx`                            | React Router: `/scan`, `/dashboard`, `/reports`                                                        |
| `pages/ScanTarget.tsx`               | Target input, validation, 6-step progress stepper, live terminal, scan lifecycle                       |
| `pages/Dashboard.tsx`                | Scan history sidebar, vulnerability table (search/sort), score card, OWASP matrix, AI analysis display |
| `pages/Reports.tsx`                  | Scan selector, report generation, preview, export actions                                              |
| `components/Layout.tsx`              | App shell — collapsible sidebar nav, header, status indicator                                          |
| `components/SecurityScoreCard.tsx`   | Score circle (0-100), letter grade, confidence, breakdown, recommendations                             |
| `components/OWASPCoverageMatrix.tsx` | 5×2 grid of OWASP categories with hit counts and tooltips                                              |
| `components/ReportViewer.tsx`        | In-app report renderer with score, OWASP grid, ports, vulns with AI inline                             |
| `lib/scanStore.ts`                   | Global singleton state store (in-memory, persists across page navigation)                              |
| `lib/useScanStore.ts`                | React hook wrapping scanStore with useState/useEffect subscription                                     |
| `types/electron.d.ts`                | TypeScript declarations for entire `window.electronAPI` interface                                      |

---

## IPC Bridge — `electron/preload.ts`

All communication between frontend and backend goes through `contextBridge.exposeInMainWorld('electronAPI', ...)`. The UI calls `window.electronAPI.scanner.runNmap()`, which internally calls `ipcRenderer.invoke('scanner:run-nmap')`, which triggers the registered `ipcMain.handle(...)` in `main.ts`.

**Security model:** `contextIsolation: true`, `nodeIntegration: false` — the UI cannot access the file system or run programs directly. Only pre-approved IPC channels are exposed.

| Channel                       | Direction    | Purpose                 |
| ----------------------------- | ------------ | ----------------------- |
| `scanner:run-nmap`            | UI → Backend | Start a scan            |
| `scanner:validate-target`     | UI → Backend | Check allowlist         |
| `scanner:get-history`         | UI → Backend | Load past scans         |
| `scanner:abort`               | UI → Backend | Kill running scan       |
| `scanner:delete-scan`         | UI → Backend | Remove saved scan       |
| `scanner:progress`            | Backend → UI | Live scan output lines  |
| `scanner:phase-result`        | Backend → UI | Phase 1 early results   |
| `llm:analyze-vulnerabilities` | UI → Backend | Send vulns to Gemini AI |
| `report:export`               | UI → Backend | Save assessment report  |
| `report:export-pentest`       | UI → Backend | Save pentest report     |
| `report:generate-pentest`     | UI → Backend | Generate pentest report |
| `report:get-history`          | UI → Backend | Load past reports       |
| `report:open`                 | UI → Backend | Open saved report       |
| `report:delete`               | UI → Backend | Delete a report         |
| `report:open-file`            | UI → Backend | Open file in browser    |

---

## Data Storage

| What                  | Where                                      | Format               |
| --------------------- | ------------------------------------------ | -------------------- |
| Scan results (raw)    | `data/scans/scan-{timestamp}.xml`          | Nmap XML             |
| Scan results (parsed) | `data/scans/scan-{timestamp}.json`         | Structured JSON      |
| Generated reports     | `data/reports/report_{target}_{date}.html` | HTML                 |
| Report metadata       | `data/reports/metadata.json`               | JSON                 |
| Target allowlist      | `allowed-targets.json`                     | JSON                 |
| API key               | `.env`                                     | `GEMINI_API_KEY=...` |

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
