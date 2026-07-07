<p align="center">
  <img src="frontend/public/icon.png" alt="PurpleTeamAI" width="120" />
</p>

<h1 align="center">PurpleTeam Suite</h1>

<p align="center">
  An integrated deterministic AI framework for vulnerability discovery, prioritisation and remediation guidance.
</p>

<p align="center">
  <em>CST3590 Individual Project · Middlesex University London · 2026</em>
</p>

---

## About

PurpleTeam Suite | BSc Cyber Security Final Year Project | Middlesex University London

The question I wanted to answer was whether an inherently non-deterministic LLM could be architecturally constrained enough to function as a deterministic-first tool inside a real purple team workflow, where outputs have to be reproducible and operationally trustworthy, not just plausible-sounding.

So I built an Electron, React and TypeScript desktop application implementing a ten-stage automated vulnerability assessment pipeline: two-phase Nmap scanning, deterministic OWASP Top 10 classification via a weighted keyword mapper that runs before the LLM ever sees the data, exploitability-aware contextual scoring using four stacked multipliers (port exposure, service exposure, authentication weakness, TLS absence), Gemini 2.5 Flash analysis under strict JSON schema enforcement, and a post-AI hallucination guard that cross-validates every AI-generated OWASP label against the deterministic classifier, scoring disagreements into a quantified trust score rather than treating AI confidence as self-validating.

Key results: contextual weighting produced a 69.2% amplification in severity deductions versus flat scoring, ablation confirmed it as the highest-impact component with a 74-point delta when disabled, a full scan-remediate-rescan cycle produced a 57-point score improvement with 53% fewer findings, and zero fabricated CVE identifiers were recorded across all 11 AI-guarded scans.

Supervised by David Neilson at Middlesex University London, graded First-class standard.

## Requirements

### Runtime (installed app / EXE)

- Nmap on the system `PATH` (Kali Linux already includes it; Windows: install from https://nmap.org/download.html; macOS: `brew install nmap`; Ubuntu/Debian: `sudo apt install nmap`)
- A Google Gemini API key (set `GEMINI_API_KEY` in `frontend/.env` or as an environment variable)

### Development

- Node.js 18+

### Gemini API key setup

Create `frontend/.env` (copy `frontend/.env.example`) with:

```env
GEMINI_API_KEY=your_key_here
```

If you are using the prebuilt EXE without rebuilding, set `GEMINI_API_KEY` in your OS environment before launching.

## Quick start

```bash
git clone https://github.com/umfhero/PurpleTeamAI.git
cd PurpleTeamAI/frontend
npm install

npm run dev
```

To run the vulnerable testbed (optional, for end-to-end testing against a local target):

```bash
cd ../test-site
npm install
node server.js
```

To build a standalone installer:

```bash
cd ../frontend
npm run build
```

## Repository structure

```
PurpleTeamAI/
├── frontend/                    # Electron + React application
│   ├── electron/                # Main process (backend)
│   │   ├── scanner/             # Nmap orchestration, XML parsing
│   │   ├── analysis/            # OWASP mapping, scoring, hallucination guard,
│   │   │                        #   delta comparison, feature toggles
│   │   ├── llm/                 # Gemini integration with schema enforcement
│   │   ├── reports/             # PDF generators (pentest + delta)
│   │   ├── main.ts              # Electron entry point + IPC handlers
│   │   └── preload.ts           # IPC bridge (context-isolated)
│   ├── src/                     # React renderer (frontend)
│   │   ├── components/          # UI components
│   │   ├── pages/               # Scan, Results, Reports pages
│   │   └── store/               # Shared state
│   ├── public/                  # Static assets
│   └── allowed-targets.json     # Scan allowlist (safety enforcement)
│
├── test-site/                   # Controlled vulnerable testbed
│   ├── server.js                # Vulnerable server (12 intentional issues)
│   ├── server-fixed.js          # Remediated server (for delta testing)
│   └── public/                  # Test pages and assets
│
├── data/                        # Generated at runtime
│   ├── scans/                   # Scan results (JSON, newest first)
│   ├── reports/                 # Exported PDF reports
│   └── hallucination-metrics.json
│
└── README.md
```

## Usage

1. Launch the app with `npm run dev`.
2. Enter an allowlisted target on the Scan page and click Start.
3. Phase 1 (top 100 ports) returns early; Phase 2 (full sweep) continues in the background.
4. Review findings, AI analysis and trust score on the Results page.
5. Export a PDF report or run a second scan to generate a delta comparison.

## Ethics and authorised use

Active network scanning is regulated under the Computer Misuse Act 1990. The allowlist in `frontend/allowed-targets.json` is enforced in the main process before Nmap is invoked. Do not modify the allowlist to target systems you do not own or have explicit written permission to scan.


## Licence
Copyright (c) 2026 umf. All rights reserved.

This source code and all associated files are the exclusive property of the copyright holder.

No part of this repository may be used, copied, modified, merged, published, distributed,
sublicensed, or sold, in whole or in part, without the prior written permission of the
copyright holder.

This software is provided "as is", without warranty of any kind.
