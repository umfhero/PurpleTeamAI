# PurpleTeamAI — 10-Week Development Plan

> **Start**: Week of February 9, 2026
> **Deadline**: April 24, 2026 (23:59)
> **Ref**: [Designrules.md](./Designrules.md) for all UI decisions

---

## Week 1 — Foundation & Environment (Feb 9–15)

> **Goal**: Dev environment fully working, Electron shell running, scanning safe targets confirmed.

- [x] Install & verify: Node.js 18+, Nmap, Docker, Git _(All installed ✓)_
- [ ] Spin up Kali Linux VM — confirm Nmap runs against `testphp.vulnweb.com` _(deferred — using Windows Nmap)_
- [ ] Deploy Mutillidae in Docker (`docker pull citizenstig/nowasp`) — confirm accessible on localhost _(deferred)_
- [x] Scaffold Electron into the existing `frontend/` — integrate `electron-builder` + Vite
  - Main process (`electron/main.ts`), preload script, renderer is current React app
- [x] Confirm `npm run dev` launches the Electron window with the React app inside
- [x] Create `.env.example` with `GEMINI_API_KEY=` placeholder
- [x] Set up target allowlist config (`allowed-targets.json`) with `testphp.vulnweb.com` + `localhost` entries
- [ ] Begin literature review notes (ongoing through Week 3)

### Deliverable: Electron desktop app opens, Mutillidae running in Docker, Nmap verified.

---

## Week 2 — Scanning Pipeline & Target Input (Feb 16–22)

> **Goal**: User can type a URL, the app validates it against the allowlist, runs Nmap, and stores raw JSON results.

- [ ] Build **Target Input page** — URL input field with allowlist validation + confirmation prompt before scanning
  - Follow Designrules: sharp corners, monospace type, no rounded cards, no emojis, earth-tone/orange palette
- [ ] Implement Nmap orchestration module (`scanner/nmap.ts`)
  - Accepts validated target URL
  - Runs `nmap -sV -sC --script vuln -oX` via `child_process`
  - Captures XML output
- [ ] Build XML-to-JSON parser (`scanner/parser.ts`)
  - Extract: host, open ports, service versions, CVEs, script outputs
  - Normalize into a defined JSON schema (`types/scan-result.ts`)
- [ ] Store scan results as timestamped JSON files in `data/scans/`
- [ ] Wire IPC: renderer triggers scan → main process executes → results sent back
- [ ] Add error handling: scan timeout, unreachable target, Nmap not found
- [ ] Add scan progress indicator in the UI (staggered reveal animation per Designrules)
- [ ] Continue literature review

### Deliverable: Type `testphp.vulnweb.com` → app runs Nmap → structured JSON result stored.

---

## Week 3 — Results Dashboard & Vulnerability Display (Feb 23–Mar 1)

> **Goal**: Scan results displayed in a clean, brutalist-styled dashboard with sortable vulnerability table.

- [ ] Build **Results Dashboard page** — vulnerability table with columns: Port, Service, Vulnerability, CVE, Severity
  - Brutalist layout: 1px borders, hard offset shadows, no rounded anything
  - Monospace or serif typography, high-contrast monochrome with safety-orange accents
- [ ] Implement severity colour coding (Critical/High/Medium/Low/Info)
- [ ] Add scan history sidebar — list of previous scans with timestamps
- [ ] Load and display any stored JSON scan from `data/scans/`
- [ ] Add filtering/sorting on the table (by severity, port, service)
- [ ] Create vulnerability detail view — click a row to expand full details
- [ ] Add film-grain/noise texture overlay to the UI background per Designrules
- [ ] Finish literature review — compile into structured notes for dissertation

### Deliverable: Scanned vulnerabilities displayed in styled dashboard. Literature review notes complete.

---

## Week 4 — LLM Integration (Gemini API) (Mar 2–8)

> **Goal**: Scan results are sent to Gemini, AI returns structured vulnerability analysis.

- [ ] Implement Gemini API client module (`llm/gemini.ts`)
  - Auth via `.env` API key
  - Rate limiting + retry logic for transient failures
- [ ] Design prompt template that sends JSON scan data and requests:
  1. Plain-English vulnerability statement
  2. Affected endpoints / paths
  3. Severity rating with justification
  4. Specific remediation steps (tailored to the finding)
- [ ] Parse Gemini response into structured fields (`types/llm-analysis.ts`)
- [ ] Wire into pipeline: after scan completes → auto-send to LLM → store enriched results
- [ ] Add loading state in UI — "Analysing with AI..." indicator
- [ ] Display LLM analysis alongside raw scan data in the Results Dashboard
- [ ] Test with real `testphp.vulnweb.com` scan output — validate response quality
- [ ] Begin Ollama fallback scaffold (optional, lower priority)

### Deliverable: Scans are automatically enriched with AI-generated analysis and remediation guidance.

---

## Week 5 — OWASP Mapping & Security Score (Mar 9–15)

> **Goal**: Every vulnerability mapped to OWASP Top 10, overall security score displayed.

- [ ] Build OWASP Top 10 mapping module (`analysis/owasp-mapper.ts`)
  - Map by: CVE lookup, keyword matching, LLM classification fallback
  - Categories: A01 Broken Access Control → A10 SSRF
- [ ] Design **Security Score algorithm** (0–100%):
  - Weight categories: Critical vulns (-20 each), High (-10), Medium (-5), Low (-2)
  - OWASP coverage penalty: uncovered categories slightly reduce confidence
  - Remediation potential bonus: if all have actionable fixes, slight uplift
  - Score = composite of severity impact + OWASP coverage + remediation quality
- [ ] Build **Score Display component** — large prominent score with breakdown
  - Brutalist gauge/bar, not a circular chart — hard edges, offset shadow
- [ ] Build **OWASP Coverage Matrix** — grid showing which categories were found
  - Visual: filled vs empty cells, monochrome with orange highlights for found categories
- [ ] Wire score calculation into the post-scan pipeline
- [ ] Display score + OWASP matrix on the Results Dashboard

### Deliverable: Each scan produces a security score out of 100% with OWASP category breakdown.

---

## Week 6 — Report Generation & UI Polish (Mar 16–22)

> **Goal**: Exportable security report, polished unique UI following all design rules.

- [ ] Build report generator — structured HTML/PDF output containing:
  - Target metadata + scan timestamp
  - Overall security score with breakdown
  - OWASP coverage matrix
  - Vulnerability table with AI-enriched descriptions
  - Prioritised remediation steps
- [ ] Add "Export Report" button to dashboard
- [ ] **UI polish pass** applying all Designrules:
  - [ ] Replace any remaining Inter/system-ui with distinctive serif or monospace font
  - [ ] Ensure colour palette uses OKLCH earth tones / safety orange / high-contrast mono — no purple/indigo
  - [ ] Ensure all corners are 0px — no rounded elements anywhere
  - [ ] Add noise/grain texture overlays
  - [ ] Hard offset brutalist shadows on all card-like elements
  - [ ] Staggered reveal animations on page load (no generic fades)
  - [ ] Custom SVG line art or lo-fi icons — no emojis, no 3D clay icons
- [ ] Review all pages for design consistency
- [ ] Add app-wide navigation: Target Input → Scanning → Results → Report

### Deliverable: Exportable security report, visually unique brutalist UI complete.

---

## Week 7 — Mutillidae Testing & Ollama Fallback (Mar 23–29)

> **Goal**: Framework validated against both test targets, local LLM fallback working.

- [ ] Run full scan suite against `testphp.vulnweb.com` — document all findings
- [ ] Run full scan suite against local Mutillidae — document all findings
- [ ] Compare detected vulnerabilities against known ground-truth for each target
- [ ] Calculate **Classification Correctness**: true positive rate, false positive rate
- [ ] Document any missed vulnerabilities (false negatives) and investigate causes
- [ ] Implement Ollama fallback (`llm/ollama.ts`) — same prompt structure, local model
- [ ] Add model selector in settings: Gemini (cloud) vs Ollama (local)
- [ ] Test Ollama output quality vs Gemini — document comparison
- [ ] Fix any bugs or edge cases found during testing

### Deliverable: Both targets scanned & validated, Ollama fallback operational, accuracy metrics collected.

---

## Week 8 — Evaluation & Metrics Collection (Mar 30–Apr 5)

> **Goal**: All three evaluation metrics formally measured and documented.

- [ ] **Classification Correctness** — finalise TP/FP/FN counts for both targets
  - Calculate precision, recall, F1 score
  - Create comparison table: expected vs detected
- [ ] **Remediation Quality Scoring** — apply rubric to 15–20 sample LLM outputs:
  - Completeness (0–3): addresses root cause?
  - Accuracy (0–3): technically correct?
  - Actionability (0–3): developer can apply without extra research?
  - Relevance (0–3): specific to the vulnerability context?
  - Average scores per category
- [ ] **OWASP Coverage** — document which categories detected per target
  - Create coverage table: A01–A10 × target
  - Identify systematic gaps
- [ ] Build evaluation summary page in the app (optional — nice-to-have)
- [ ] Export all metrics to structured data (CSV/JSON) for dissertation tables
- [ ] Begin writing Results & Analysis chapter with charts/tables

### Deliverable: All evaluation metrics collected, data exported for dissertation.

---

## Week 9 — Dissertation Writing & Screencast (Apr 6–12)

> **Goal**: Dissertation substantially complete, screencast recorded.

- [ ] Write/finalise dissertation chapters:
  - [ ] Introduction + problem statement
  - [ ] Literature review (from Week 1–3 notes)
  - [ ] Methodology — architecture, pipeline, LLM integration, evaluation approach
  - [ ] Results & Analysis — metrics, tables, charts from Week 8
  - [ ] Discussion — what worked, limitations, future work
  - [ ] Conclusion
- [ ] Ensure all citations follow required format (IEEE/Harvard — check uni guidelines)
- [ ] Record **15–20 minute screencast** demonstrating:
  - App launch, target input, allowlist validation
  - Nmap scan execution with progress
  - Results dashboard with vulnerability table
  - AI analysis and remediation suggestions
  - Security score and OWASP coverage matrix
  - Report export
- [ ] Edit screencast for clarity, add captions if needed

### Deliverable: Draft dissertation, recorded screencast.

---

## Week 10 — Final Polish & Submission (Apr 13–19)

> **Goal**: Everything submitted before April 24 deadline.

- [ ] Proofread dissertation — grammar, spelling, formatting
- [ ] Verify dissertation meets word count (~8,000 words) and uni template
- [ ] Finalise screencast — upload to required platform
- [ ] Code cleanup: remove dead code, add inline comments, ensure consistent naming
- [ ] Update README with final installation steps, usage examples, architecture diagram
- [ ] Push final code to GitHub with tagged release (`v1.0`)
- [ ] Create `EVALUATION.md` documenting metrics methodology and results
- [ ] Final check: all deliverables accounted for
  - [ ] Dissertation PDF
  - [ ] Screencast (15–20 min)
  - [ ] GitHub repo with docs
- [ ] **Submit portfolio to university portal (deadline: April 24, 23:59)**

### Deliverable: Everything submitted.

---

## Key Milestones Summary

| Week | Date   | Milestone                                     |
| ---- | ------ | --------------------------------------------- |
| 1    | Feb 15 | Electron app running, environment verified    |
| 2    | Feb 22 | Nmap scanning pipeline working end-to-end     |
| 3    | Mar 1  | Results dashboard displaying vulnerabilities  |
| 4    | Mar 8  | Gemini AI analysis integrated into pipeline   |
| 5    | Mar 15 | OWASP mapping + security score working        |
| 6    | Mar 22 | Report export + polished brutalist UI         |
| 7    | Mar 29 | Both targets validated, Ollama fallback ready |
| 8    | Apr 5  | All evaluation metrics collected              |
| 9    | Apr 12 | Dissertation draft + screencast recorded      |
| 10   | Apr 19 | Final submission ready                        |

---

## Priority Stack (if time gets tight)

Must-haves (non-negotiable):

1. Electron app that accepts a URL and runs Nmap
2. JSON-normalized scan results displayed in dashboard
3. Gemini API integration producing analysis + remediation
4. Security score (out of 100%)
5. OWASP Top 10 mapping
6. Report export
7. Testing against both targets with metrics

Nice-to-haves (cut if behind schedule):

- Ollama local fallback
- In-app evaluation summary page
- PDF export (HTML export is sufficient)
- Advanced filtering/sorting on dashboard
- Animated transitions
