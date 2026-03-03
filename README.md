<p align="center">
  <img src="frontend/public/icon.png" alt="PurpleTeamAI" width="120" />
</p>

# PurpleTeamAI

**Automating the Purple Team Lifecycle. An Integrated Framework for AI Assisted Vulnerability Discovery and Autonomous Remedy.**

## About

PurpleTeamAI is a dissertation project built to close a persistent gap in application security workflows. As organisations increasingly adopt rapid development practices and AI assisted code generation, they accelerate delivery while simultaneously introducing common security weaknesses that remain undetected until production. Purple teaming, the collaborative security discipline that combines offensive red team validation with defensive blue team priorities, offers a response to this problem by continuously testing detection capabilities and measuring response effectiveness, but the traditional approach suffers from significant operational friction because manual triage creates bottlenecks, scanners produce noisy output demanding expert interpretation, and remediation guidance is often too generic to be immediately actionable.

This project implements an integrated framework that automates critical segments of that lifecycle. The system orchestrates reconnaissance and vulnerability scanning through Nmap, collects raw security data, normalises it into structured formats, and passes it to Google's Gemini large language model to transform technical scanner output into plain English analysis with specific remediation steps. Every finding is mapped deterministically to OWASP Top 10 categories before the AI processes it, and every AI response is cross validated against that ground truth by a dedicated hallucination guard that flags disagreements, invented CVE references, and suspicious confidence levels.

## Technical Overview

The implementation is a cross platform Electron desktop application with a React 19 frontend written in TypeScript and styled with Tailwind CSS using a dark brutalist design system. The backend logic runs in Electron's main process and communicates with the renderer through a strict IPC bridge where context isolation is enabled and node integration is disabled, meaning the UI cannot access the filesystem or spawn processes directly and only pre approved IPC channels are exposed through the preload script.

The scanning pipeline follows a linear sequence where each module's output becomes the next module's input. A user submitted target URL is first validated against an allowlist of approved targets, then Nmap runs a progressive two phase scan where Phase 1 covers the top 100 ports for fast initial results while Phase 2 scans all 65,535 ports in the background. Raw XML output is parsed into structured JSON, the two phases are merged with deduplication, vulnerabilities are mapped to OWASP Top 10 categories through deterministic keyword matching with weighted scoring and confidence tiers, a security score from 0 to 100 is calculated with severity weighted deductions and OWASP breadth penalties, and finally the compressed vulnerability data is sent to Google Gemini for plain English analysis and remediation guidance. A post analysis hallucination guard then cross validates every AI output against the deterministic mappings and flags discrepancies with per vulnerability risk levels and an overall trust score.

The application also supports delta comparison between consecutive scans of the same target. Vulnerabilities are fingerprinted using stable identity keys derived from CVE and port combinations so that the same finding across different scans is recognised regardless of internal ID changes. Each vulnerability is classified as resolved, new, or persisting, and score changes together with OWASP coverage shifts are computed to provide measurable post remediation reassessment across the full scan lifecycle.

## Module Architecture

The codebase is organised into four backend modules under the electron directory, each with its own folder, type definitions, and barrel export.

The Scanner module orchestrates Nmap as a child process, handles the two phase progressive scan with live progress streaming to the UI via IPC, parses XML output into typed JSON, adds post processing detections for missing security headers and absent HTTPS, filters negative results automatically, and persists scan history to disk as timestamped JSON files. It also handles target normalisation by stripping URL schemes and extracting explicit ports, and on Windows it automatically switches from SYN scan to TCP connect scan because Nmap's default SYN scan fails on the Windows loopback adapter. Scanning can be aborted mid execution and is restricted to approved targets through a JSON allowlist.

The Analysis module performs all deterministic computation without external calls. It contains the OWASP mapper which matches vulnerabilities against expanded keyword vocabularies with weighted scoring, regex special cases for common vulnerability patterns, and a fallback chain for unmatched findings. The security scorer calculates a 0 to 100 score with weighted severity deductions, OWASP breadth penalties, a remediation bonus for completed pipeline runs, and a separate confidence calculation that warns when scanners found suspiciously little. The hallucination guard cross validates AI output against scan data by checking OWASP category agreement, verifying CVE references exist in the scan results, and comparing confidence levels proportionally rather than through simple binary checks. The delta comparison engine computes resolved, new, and persisting vulnerability classifications between sequential scans and supports chain computation across multiple assessment cycles for full lifecycle tracking.

The LLM module manages communication with Google Gemini. It compresses vulnerability data to essential fields before transmission, enforces structured JSON output through prompt engineering with explicit OWASP categorisation rules, uses a low temperature of 0.2 to minimise creative hallucination, implements retry logic with backoff on rate limits, and falls back through a model cascade if the primary model fails. Each vulnerability receives a plain English summary, affected endpoints, severity justification, three remediation steps, an OWASP category, and a confidence score. For larger scan results the module batches vulnerabilities transparently to stay within token limits.

The Reports module generates three styles of professional PDF report. An assessment report styled with a dark theme for internal review, a pentest style report with a light theme, cover page, table of contents, and executive summary for client facing use, and a delta comparison report that presents differences between two sequential scans with score changes, resolved and new findings, OWASP coverage shifts, and auto generated narrative conclusions. Reports are cached on disk to avoid regeneration and persisted with metadata for retrieval through the reports page.

## Anti Hallucination Strategy

The system addresses AI reliability through multiple complementary layers rather than relying on a single validation mechanism. Deterministic keyword matching categorises vulnerabilities before the AI sees them, establishing ground truth that the AI cannot override. The prompt constrains output to a fixed JSON schema with typed enums so the model cannot invent OWASP categories outside the A01 to A10 range. Data compression ensures only scanner verified data reaches the model, preventing speculation about unseen systems. After the AI responds, the hallucination guard cross validates every output, flagging OWASP category disagreements, fabricated CVE references not present in scan data, and confidence levels that diverge significantly from the deterministic assessment. The guard produces a trust score from 0 to 100 using a weighted formula where fabricated CVEs incur severe penalties while subjective labelling differences are treated proportionally. All metrics are logged to a longitudinal dataset after every analysis run, tracking OWASP disagreement rates, fabricated CVE counts, confidence mismatch rates, and overall trust scores across scans for empirical evaluation of AI reliability over time.

## Evaluation Approach

The framework is evaluated across three dimensions. Classification correctness measures the system's ability to accurately identify vulnerabilities by comparing detected findings against ground truth expectations from training targets with known vulnerability profiles, calculating true positive and false positive rates. Remediation suggestion quality is scored against a structured rubric assessing completeness, accuracy, actionability, and relevance. OWASP category coverage tracks how comprehensively the framework identifies vulnerabilities across all ten categories, revealing systematic gaps in detection.

A controlled localhost test environment supports empirical evaluation by providing a deliberately vulnerable Express server with twelve intentional findings spanning missing security headers, absent HTTPS, CSRF weaknesses, reflected and DOM based XSS, insecure cookies, exposed directories and backup files, open redirects, and basic authentication panels. These vulnerabilities can be selectively remediated between scan cycles, enabling measurement of score improvement, vulnerability reduction, and delta comparison behaviour under controlled conditions where the ground truth is fully known.

## Getting Started

The project requires Node.js 18 or later, Git, Nmap installed on the host system, and a Google Gemini API key stored in a .env file at the frontend root. Ollama can serve as a local fallback if the Gemini API is unavailable.

```
git clone <repository url>
cd PurpleTeamAI
cd frontend
npm install
npm run dev
```

## Ethical Constraints

All scanning is confined to authorised environments. Testing is performed exclusively against the publicly available vulnerable training platform testphp.vulnweb.com, locally deployed instances of Mutillidae in isolated Docker containers, and the included localhost test server. No personal data is collected or processed. The codebase enforces a target allowlist and requires user confirmation before initiating any scan.

**Status.** In active development as of March 2026.
