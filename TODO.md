# PurpleTeamAI — 10-Week Development Plan

> **Start**: Week of February 9, 2026
> **Deadline**: April 24, 2026 (23:59)
> **Ref**: [Designrules.md](./Designrules.md) for all UI decisions
> **Ref**: [vunlist.md](./vunlist.md) for target vulnerability ground truth

---

## Detection Coverage — `testphp.vulnweb.com` Ground Truth

> Mapping of [vunlist.md](./vunlist.md) vulnerabilities against current scanner capabilities.
> This drives the Week 7+ priorities.

### Can Detect Now (via Nmap NSE scripts + parser post-processing)

| Vulnerability                     | Detection Method                                                           | OWASP |
| --------------------------------- | -------------------------------------------------------------------------- | ----- |
| SQL Injection (error/union/blind) | `http-sql-injection` script (Phase 2)                                      | A03   |
| Reflected XSS                     | `http-phpself-xss`, `http-dombased-xss`, `http-unsafe-output-escaping`     | A03   |
| Stored XSS                        | `http-stored-xss` (limited — can't interact with forms)                    | A03   |
| Directory Traversal               | `http-passwd` (tries `../../etc/passwd`)                                   | A01   |
| Sensitive Info Disclosure         | `http-enum` finds exposed files/dirs                                       | A05   |
| CSRF                              | `http-csrf` script                                                         | A08   |
| HTTP Only (No HTTPS)              | Parser post-processing: port 80 open, 443 absent → synthetic vuln          | A02   |
| Clickjacking                      | Parser post-processing: missing `X-Frame-Options` in `http-headers` output | A05   |
| Missing CSP                       | Parser post-processing: missing `Content-Security-Policy` header           | A05   |
| Missing HSTS                      | Parser post-processing: missing `Strict-Transport-Security` header         | A02   |
| Vulnerable Components             | `vulners` script with CVSS scoring                                         | A06   |
| SSL/TLS Weaknesses                | `ssl-enum-ciphers`, `ssl-poodle`                                           | A02   |

### Cannot Detect Yet — Requires Additional Work

| Vulnerability               | Why Nmap Can't Find It                                  | Possible Approach                                     |
| --------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| Stored XSS (guestbook)      | Requires form submission + stored payload retrieval     | Custom HTTP probe or ZAP integration                  |
| LFI (`showimage.php?file=`) | Nmap doesn't test app-specific parameters               | Custom HTTP probe with known LFI payloads             |
| IDOR (user profiles)        | Requires authenticated session + parameter manipulation | Custom HTTP probe or manual testing                   |
| Brute-Force (login.php)     | Nmap `http-form-brute` exists but slow/aggressive       | Add `http-form-brute` to Phase 2 (controlled)         |
| Weak Passwords (test/test)  | Needs credential testing against login form             | `http-form-brute` with small wordlist or custom probe |
| Password over HTTP          | Partially covered by HTTP-only detection                | Enhance: detect login forms on HTTP pages             |
| HPP (parameter pollution)   | No Nmap script exists                                   | Custom HTTP probe or LLM inference                    |
| Email Disclosure            | No Nmap script for source scanning                      | Custom HTTP probe (fetch pages, regex for emails)     |

### LLM Can Infer (from scan context)

The Gemini analysis can flag several issues by reasoning about what the scan data implies:

- **No HTTPS** → passwords sent in cleartext (A02)
- **No rate limiting headers** → possible brute-force (A07)
- **No security headers** → clickjacking, XSS, MIME sniffing risks (A05)
- **Open directory listings** → sensitive info exposure (A01)
- **Old software versions** → known CVEs (A06)

---

## Week 1 — Foundation & Environment (Feb 9–15) ✓

> **Goal**: Dev environment fully working, Electron shell running, scanning safe targets confirmed.

- [x] Install & verify: Node.js 18+, Nmap, Docker, Git
- [ ] Spin up Kali Linux VM — confirm Nmap runs against `testphp.vulnweb.com` _(deferred — using Windows Nmap)_
- [ ] Deploy Mutillidae in Docker (`docker pull citizenstig/nowasp`) _(deferred)_
- [x] Scaffold Electron into the existing `frontend/` — integrate `electron-builder` + Vite
- [x] Confirm `npm run dev` launches the Electron window with the React app inside
- [x] Create `.env.example` with `GEMINI_API_KEY=` placeholder
- [x] Set up target allowlist config (`allowed-targets.json`)
- [ ] Begin literature review notes (ongoing through Week 3)

### Deliverable: Electron desktop app opens, Nmap verified.

---

## Week 2 — Scanning Pipeline & Target Input (Feb 16–22) ✓

> **Goal**: User can type a URL, the app validates it against the allowlist, runs Nmap, and stores raw JSON results.

- [x] Build **Target Input page** — URL input field with allowlist validation + confirmation prompt
- [x] Implement Nmap orchestration module (`scanner/nmap.ts`)
- [x] Build XML-to-JSON parser (`scanner/parser.ts`)
- [x] Store scan results as timestamped JSON files in `data/scans/`
- [x] Wire IPC: renderer triggers scan → main process executes → results sent back
- [x] Add error handling: scan timeout, unreachable target, Nmap not found
- [x] Add scan progress indicator in the UI

### Deliverable: Type `testphp.vulnweb.com` → app runs Nmap → structured JSON result stored.

---

## Week 3 — Results Dashboard & Vulnerability Display (Feb 23–Mar 1) ✓

> **Goal**: Scan results displayed in a clean dashboard with sortable vulnerability table.

- [x] Build **Results Dashboard page** — vulnerability table with columns: Port, Service, Vulnerability, CVE, Severity
- [x] Implement severity colour coding (Critical/High/Medium/Low/Info)
- [x] Add scan history sidebar
- [x] Load and display any stored JSON scan from `data/scans/`
- [x] Add filtering/sorting on the table
- [x] Create vulnerability detail view

### Deliverable: Scanned vulnerabilities displayed in styled dashboard.

---

## Week 4 — LLM Integration (Gemini API) (Mar 2–8) ✓

> **Goal**: Scan results are sent to Gemini, AI returns structured vulnerability analysis.

- [x] Implement Gemini API client module (`llm/gemini.ts`)
- [x] Design prompt template for vulnerability analysis + remediation
- [x] Parse Gemini response into structured fields
- [x] Wire into pipeline: after scan completes → auto-send to LLM → store enriched results
- [x] Add loading state in UI
- [x] Display LLM analysis alongside raw scan data
- [ ] Test with real `testphp.vulnweb.com` scan output — validate response quality
- [ ] Begin Ollama fallback scaffold (optional, lower priority)

### Deliverable: Scans are automatically enriched with AI-generated analysis and remediation guidance.

---

## Week 5 — OWASP Mapping & Security Score (Mar 9–15) ✓

> **Goal**: Every vulnerability mapped to OWASP Top 10, overall security score displayed.

- [x] Build OWASP Top 10 mapping module (`analysis/owasp-mapper.ts`)
- [x] Design **Security Score algorithm** (0–100)
- [x] Build **Score Display component** with breakdown
- [x] Build **OWASP Coverage Matrix**
- [x] Wire score calculation into the post-scan pipeline
- [x] Display score + OWASP matrix on the Results Dashboard
- [x] **Score confidence indicator** — LOW/MEDIUM/HIGH confidence based on scan coverage
  - 0 vulns on web target → LOW confidence (not "perfect security")
  - Few vulns → MEDIUM confidence
  - 5+ vulns → HIGH confidence with reason string displayed in UI

### Deliverable: Each scan produces a security score with OWASP breakdown and confidence level.

---

## Week 6 — Report Generation, Progressive Scan & UI Polish (Mar 16–22) ✓

> **Goal**: Exportable security report, progressive 2-phase scanning, polished UI.

- [x] Build report generator — structured HTML output
- [x] Add "Export Report" button to dashboard
- [x] **Progressive 2-phase scan** (replaces manual scan type selection):
  - Phase 1: Quick discovery (top 100 ports, -sV -sC, vuln+vulners+ssl, ~2–4 min)
  - Phase 2: Deep scan (all 65535 ports, SQLi+XSS+CSRF+enum scripts, ~10–25 min)
  - Phase 1 results shown immediately while Phase 2 runs
  - Merge + deduplicate results from both phases
- [x] **Parser post-processing** for additional detection:
  - Missing security headers (X-Frame-Options, CSP, HSTS, X-Content-Type-Options)
  - HTTP-only (no HTTPS) detection from port analysis
- [x] **UI polish pass** per Designrules:
  - Typography, colour, layout, texture, visuals, shadows all aligned
  - 6-step progress stepper for progressive scan states
- [x] Review all pages for design consistency

### Deliverable: Exportable report, progressive scanning, polished brutalist UI complete.

---

## Week 7 — Ground-Truth Validation & Detection Gaps (Mar 23–29)

> **Goal**: Validate scanner against vunlist.md ground truth. Identify and address detection gaps.

- [ ] Run full progressive scan against `testphp.vulnweb.com` — document ALL findings
- [ ] Compare detected vulnerabilities against `vunlist.md` ground truth
  - Create comparison table: expected (vunlist.md) vs detected (scanner output)
  - Mark each as: TP (true positive), FN (false negative), FP (false positive)
- [ ] Calculate **Classification Correctness**: precision, recall, F1 score
- [ ] Investigate false negatives — for each missed vuln from vunlist.md:
  - [ ] Is there an Nmap NSE script that should have caught it?
  - [ ] Did the parser filter it? Did severity classification miss it?
  - [ ] Does it fundamentally require a different scanning approach?
- [ ] **Improve detection for addressable gaps**:
  - [ ] Add `http-form-brute` to Phase 2 with small wordlist (brute-force/weak password detection)
  - [ ] Tune `http-sql-injection` script args for better coverage of testphp endpoints
  - [ ] Verify `http-stored-xss` actually runs and produces output on the guestbook
  - [ ] Add `http-default-accounts` to Phase 2 for default credential detection
- [ ] Run full scan suite against local Mutillidae (if set up) — document findings
- [ ] Fix any parser bugs or severity misclassifications found during validation

### Deliverable: Ground-truth comparison table, detection gap analysis, improved Nmap script coverage.

---

## Week 8 — Evaluation Metrics & LLM Quality (Mar 30–Apr 5)

> **Goal**: All three evaluation metrics formally measured and documented.

- [ ] **Classification Correctness** — finalise TP/FP/FN counts for testphp.vulnweb.com
  - Calculate precision, recall, F1 score
  - Create comparison table: vunlist.md expected vs detected
  - Break down by OWASP category (which categories have best/worst detection?)
- [ ] **Remediation Quality Scoring** — apply rubric to 15–20 sample LLM outputs:
  - Completeness (0–3): addresses root cause?
  - Accuracy (0–3): technically correct?
  - Actionability (0–3): developer can apply without extra research?
  - Relevance (0–3): specific to the vulnerability context?
  - Average scores per category
- [ ] **OWASP Coverage** — document which categories detected per target
  - Create coverage table: A01–A10 × target
  - Identify systematic gaps
  - Note which categories the LLM was able to infer vs scanner directly detected
- [ ] **Scan Confidence Validation** — verify confidence indicator accuracy:
  - Does LOW confidence correlate with missed vulnerabilities?
  - Does HIGH confidence correlate with good detection coverage?
- [ ] Export all metrics to structured data (CSV/JSON) for dissertation tables
- [ ] Begin writing Results & Analysis chapter with charts/tables
- [ ] Implement Ollama fallback (`llm/ollama.ts`) — same prompt structure, local model (if time permits)

### Deliverable: All evaluation metrics collected, data exported for dissertation.

---

## Week 9 — Dissertation Writing & Screencast (Apr 6–12)

> **Goal**: Dissertation substantially complete, screencast recorded.

- [ ] Write/finalise dissertation chapters:
  - [ ] Introduction + problem statement
  - [ ] Literature review (from Week 1–3 notes)
  - [ ] Methodology — architecture, pipeline, LLM integration, evaluation approach
  - [ ] Results & Analysis — metrics, tables, charts from Week 8
  - [ ] Discussion — what worked, limitations (Nmap coverage gaps), future work
  - [ ] Conclusion
- [ ] Key discussion points to address:
  - [ ] Nmap's limitations as a web app scanner vs dedicated DAST tools
  - [ ] The value of LLM inference in filling detection gaps
  - [ ] Score confidence as a mitigation for false sense of security
  - [ ] Progressive scanning UX tradeoffs
- [ ] Ensure all citations follow required format
- [ ] Record **15–20 minute screencast** demonstrating:
  - App launch, target input, allowlist validation
  - Progressive scan execution (Phase 1 → Phase 2)
  - Results dashboard with vulnerability table
  - AI analysis and remediation suggestions
  - Security score with confidence indicator
  - OWASP coverage matrix
  - Report export

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
- [ ] Create `EVALUATION.md` documenting:
  - Classification correctness results (TP/FP/FN, precision, recall, F1)
  - Remediation quality rubric scores
  - OWASP coverage matrix
  - Detection gap analysis vs vunlist.md
  - Scan confidence validation
- [ ] Final check: all deliverables accounted for
  - [ ] Dissertation PDF
  - [ ] Screencast (15–20 min)
  - [ ] GitHub repo with docs
- [ ] **Submit portfolio to university portal (deadline: April 24, 23:59)**

### Deliverable: Everything submitted.

---

## Key Milestones Summary

| Week | Date   | Milestone                                      |
| ---- | ------ | ---------------------------------------------- |
| 1    | Feb 15 | Electron app running, environment verified     |
| 2    | Feb 22 | Nmap scanning pipeline working end-to-end      |
| 3    | Mar 1  | Results dashboard displaying vulnerabilities   |
| 4    | Mar 8  | Gemini AI analysis integrated into pipeline    |
| 5    | Mar 15 | OWASP mapping + security score + confidence    |
| 6    | Mar 22 | Progressive scan + report export + polished UI |
| 7    | Mar 29 | Ground-truth validation, detection gaps fixed  |
| 8    | Apr 5  | All evaluation metrics collected               |
| 9    | Apr 12 | Dissertation draft + screencast recorded       |
| 10   | Apr 19 | Final submission ready                         |

---

## Priority Stack (if time gets tight)

Must-haves (non-negotiable):

1. Electron app that accepts a URL and runs Nmap (progressive 2-phase)
2. JSON-normalized scan results displayed in dashboard
3. Gemini API integration producing analysis + remediation
4. Security score with **confidence indicator** (not just 100 = good)
5. OWASP Top 10 mapping
6. Report export
7. Ground-truth validation against `vunlist.md` with metrics
8. Detection gap analysis documenting what Nmap can/can't find

Nice-to-haves (cut if behind schedule):

- Ollama local fallback
- Custom HTTP probes for IDOR/LFI/stored XSS
- In-app evaluation summary page
- PDF export (HTML export is sufficient)
- Mutillidae testing (focus on testphp.vulnweb.com)
- Advanced filtering/sorting on dashboard
