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

PurpleTeam Suite is an Electron desktop application that automates the purple-team lifecycle in a single pipeline: Nmap scanning, deterministic OWASP Top 10 classification, exploitability-aware scoring, AI-assisted analysis, hallucination validation, delta comparison and exportable PDF reporting.

## Requirements

- Node.js 18+
- Nmap on the system `PATH`
- A Google Gemini API key (free tier is sufficient)

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
