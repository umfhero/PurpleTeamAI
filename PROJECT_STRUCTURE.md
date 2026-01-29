# PurpleTeamAI - Project Structure

This document outlines the complete directory structure for the PurpleTeamAI project.

```
PurpleTeamAI/
│
├── 📁 frontend/                          # Electron + React Application
│   ├── 📁 src/
│   │   ├── 📁 main/                      # Electron Main Process
│   │   │   ├── index.ts                  # Main entry point
│   │   │   ├── window.ts                 # Window management
│   │   │   ├── ipc-handlers.ts           # IPC message handlers
│   │   │   ├── sidecar-manager.ts        # Python sidecar lifecycle
│   │   │   ├── menu.ts                   # Application menu
│   │   │   └── updater.ts                # Auto-update logic
│   │   │
│   │   ├── 📁 preload/                   # Secure IPC Bridge
│   │   │   ├── index.ts                  # Preload script
│   │   │   ├── api.ts                    # Exposed APIs
│   │   │   └── validators.ts             # Input validation
│   │   │
│   │   ├── 📁 renderer/                  # React Application
│   │   │   ├── 📁 components/            # Reusable components
│   │   │   │   ├── 📁 common/
│   │   │   │   │   ├── Button.tsx
│   │   │   │   │   ├── Card.tsx
│   │   │   │   │   ├── Input.tsx
│   │   │   │   │   ├── Modal.tsx
│   │   │   │   │   └── Table.tsx
│   │   │   │   │
│   │   │   │   ├── 📁 layout/
│   │   │   │   │   ├── Header.tsx
│   │   │   │   │   ├── Sidebar.tsx
│   │   │   │   │   ├── Footer.tsx
│   │   │   │   │   └── Layout.tsx
│   │   │   │   │
│   │   │   │   ├── 📁 recon/
│   │   │   │   │   ├── ScanConfig.tsx
│   │   │   │   │   ├── ScanProgress.tsx
│   │   │   │   │   ├── ScanResults.tsx
│   │   │   │   │   └── NetworkMap.tsx
│   │   │   │   │
│   │   │   │   ├── 📁 pentest/
│   │   │   │   │   ├── VulnerabilityList.tsx
│   │   │   │   │   ├── OWASPDashboard.tsx
│   │   │   │   │   ├── MITREHeatmap.tsx
│   │   │   │   │   └── ExploitTester.tsx
│   │   │   │   │
│   │   │   │   ├── 📁 defense/
│   │   │   │   │   ├── AlertDashboard.tsx
│   │   │   │   │   ├── LogViewer.tsx
│   │   │   │   │   ├── RemediationPanel.tsx
│   │   │   │   │   └── ComplianceStatus.tsx
│   │   │   │   │
│   │   │   │   └── 📁 ai/
│   │   │   │       ├── RiskScore.tsx
│   │   │   │       ├── AIInsights.tsx
│   │   │   │       └── ReportGenerator.tsx
│   │   │   │
│   │   │   ├── 📁 pages/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Reconnaissance.tsx
│   │   │   │   ├── Pentesting.tsx
│   │   │   │   ├── Defense.tsx
│   │   │   │   ├── Reports.tsx
│   │   │   │   └── Settings.tsx
│   │   │   │
│   │   │   ├── 📁 hooks/
│   │   │   │   ├── useScans.ts
│   │   │   │   ├── useVulnerabilities.ts
│   │   │   │   ├── useAlerts.ts
│   │   │   │   └── useAI.ts
│   │   │   │
│   │   │   ├── 📁 services/
│   │   │   │   ├── api.ts                # API client
│   │   │   │   ├── electron-api.ts       # Electron IPC wrapper
│   │   │   │   └── websocket.ts          # Real-time updates
│   │   │   │
│   │   │   ├── 📁 store/
│   │   │   │   ├── index.ts
│   │   │   │   ├── scans.ts
│   │   │   │   ├── vulnerabilities.ts
│   │   │   │   └── settings.ts
│   │   │   │
│   │   │   ├── 📁 types/
│   │   │   │   ├── scan.ts
│   │   │   │   ├── vulnerability.ts
│   │   │   │   ├── alert.ts
│   │   │   │   └── report.ts
│   │   │   │
│   │   │   ├── 📁 utils/
│   │   │   │   ├── formatters.ts
│   │   │   │   ├── validators.ts
│   │   │   │   └── helpers.ts
│   │   │   │
│   │   │   ├── App.tsx                   # Root component
│   │   │   ├── main.tsx                  # React entry point
│   │   │   └── index.css                 # Global styles
│   │   │
│   │   └── 📁 assets/
│   │       ├── icons/
│   │       └── images/
│   │
│   ├── 📁 public/
│   │   └── index.html
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── electron-builder.yml              # Build configuration
│
├── 📁 backend-sidecar/                   # Python Execution Layer
│   ├── 📁 app/
│   │   ├── 📁 tools/                     # Security Tool Integrations
│   │   │   ├── 📁 recon/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── nmap_wrapper.py
│   │   │   │   ├── sublist3r_wrapper.py
│   │   │   │   ├── scapy_wrapper.py
│   │   │   │   ├── theharvester_wrapper.py
│   │   │   │   └── shodan_wrapper.py
│   │   │   │
│   │   │   ├── 📁 pentest/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── sqlmap_wrapper.py
│   │   │   │   ├── xsstrike_wrapper.py
│   │   │   │   ├── nikto_wrapper.py
│   │   │   │   └── zap_wrapper.py
│   │   │   │
│   │   │   ├── 📁 defense/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── log_parser.py
│   │   │   │   ├── ids_monitor.py
│   │   │   │   └── firewall_manager.py
│   │   │   │
│   │   │   └── base.py                   # Base tool class
│   │   │
│   │   ├── 📁 parsers/                   # LLM-Ready Data Normalizers
│   │   │   ├── __init__.py
│   │   │   ├── nmap_parser.py
│   │   │   ├── sublist3r_parser.py
│   │   │   ├── sqlmap_parser.py
│   │   │   ├── log_parser.py
│   │   │   └── base_parser.py
│   │   │
│   │   ├── 📁 ipc/                       # IPC Communication
│   │   │   ├── __init__.py
│   │   │   ├── server.py                 # HTTP/Socket server
│   │   │   ├── handlers.py               # Request handlers
│   │   │   └── validators.py             # Request validation
│   │   │
│   │   ├── 📁 models/                    # Data Models
│   │   │   ├── __init__.py
│   │   │   ├── scan.py
│   │   │   ├── vulnerability.py
│   │   │   └── finding.py
│   │   │
│   │   ├── 📁 utils/
│   │   │   ├── __init__.py
│   │   │   ├── logger.py
│   │   │   ├── sanitizer.py
│   │   │   └── helpers.py
│   │   │
│   │   ├── config.py                     # Configuration
│   │   └── main.py                       # Sidecar entry point
│   │
│   ├── 📁 tests/
│   │   ├── test_tools.py
│   │   ├── test_parsers.py
│   │   └── test_ipc.py
│   │
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
│
├── 📁 ai-engine/                         # LangChain Reasoning Layer
│   ├── 📁 app/
│   │   ├── 📁 agents/                    # LangChain Agents
│   │   │   ├── __init__.py
│   │   │   ├── recon_agent.py
│   │   │   ├── vulnerability_agent.py
│   │   │   ├── threat_agent.py
│   │   │   ├── remediation_agent.py
│   │   │   └── report_agent.py
│   │   │
│   │   ├── 📁 chains/                    # LangChain Workflows
│   │   │   ├── __init__.py
│   │   │   ├── analysis_chain.py
│   │   │   ├── mapping_chain.py
│   │   │   └── scoring_chain.py
│   │   │
│   │   ├── 📁 tools/                     # LangChain Tools
│   │   │   ├── __init__.py
│   │   │   ├── owasp_mapper.py
│   │   │   ├── mitre_mapper.py
│   │   │   ├── cve_lookup.py
│   │   │   └── risk_calculator.py
│   │   │
│   │   ├── 📁 knowledge/                 # Knowledge Base
│   │   │   ├── 📁 data/
│   │   │   │   ├── owasp_top10.json
│   │   │   │   ├── mitre_attack.json
│   │   │   │   ├── cve_database.json
│   │   │   │   └── remediation_patterns.json
│   │   │   │
│   │   │   ├── __init__.py
│   │   │   ├── vector_store.py
│   │   │   └── embeddings.py
│   │   │
│   │   ├── 📁 scoring/                   # Risk Scoring
│   │   │   ├── __init__.py
│   │   │   ├── risk_scorer.py
│   │   │   ├── cvss_calculator.py
│   │   │   └── priority_ranker.py
│   │   │
│   │   ├── 📁 reporting/                 # Report Generation
│   │   │   ├── __init__.py
│   │   │   ├── executive_report.py
│   │   │   ├── technical_report.py
│   │   │   ├── compliance_report.py
│   │   │   └── templates/
│   │   │       ├── executive.md
│   │   │       ├── technical.md
│   │   │       └── compliance.md
│   │   │
│   │   ├── 📁 prompts/                   # Prompt Templates
│   │   │   ├── __init__.py
│   │   │   ├── analysis_prompts.py
│   │   │   ├── remediation_prompts.py
│   │   │   └── report_prompts.py
│   │   │
│   │   ├── 📁 models/
│   │   │   ├── __init__.py
│   │   │   ├── llm_config.py
│   │   │   └── model_manager.py
│   │   │
│   │   ├── config.py
│   │   └── main.py
│   │
│   ├── 📁 tests/
│   │   ├── test_agents.py
│   │   ├── test_chains.py
│   │   └── test_scoring.py
│   │
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
│
├── 📁 shared/                            # Shared Code & Types
│   ├── 📁 types/
│   │   ├── scan.d.ts
│   │   ├── vulnerability.d.ts
│   │   └── finding.d.ts
│   │
│   ├── 📁 schemas/
│   │   ├── scan_schema.json
│   │   ├── vulnerability_schema.json
│   │   └── finding_schema.json
│   │
│   └── 📁 constants/
│       ├── owasp.ts
│       ├── mitre.ts
│       └── severity.ts
│
├── 📁 docs/                              # Documentation
│   ├── TODO.md                           # Implementation roadmap
│   ├── ARCHITECTURE.md                   # Technical architecture
│   ├── PROJECT_STRUCTURE.md              # This file
│   ├── API.md                            # API documentation
│   ├── SECURITY.md                       # Security guidelines
│   └── CONTRIBUTING.md                   # Contribution guide
│
├── 📁 assets/                            # Project Assets
│   ├── Banner.png
│   ├── Smallerbanner.png
│   └── icons/
│
├── 📁 scripts/                           # Build & Utility Scripts
│   ├── setup.sh                          # Initial setup
│   ├── build.sh                          # Build script
│   └── test.sh                           # Test runner
│
├── .gitignore
├── .gitattributes
├── README.md                             # Main README
├── LICENSE
└── docker-compose.yml                    # Optional: For development
```

## Key Directories Explained

### `/frontend`
The Electron + React application that provides the user interface. Contains three main subdirectories:
- `main/`: Electron main process (Node.js)
- `preload/`: Secure IPC bridge
- `renderer/`: React application (UI)

### `/backend-sidecar`
Python execution layer that runs security tools and normalizes their output for AI consumption.

### `/ai-engine`
LangChain-based reasoning layer that provides intelligent analysis, risk scoring, and report generation.

### `/shared`
Common types, schemas, and constants used across all layers.

### `/docs`
Comprehensive project documentation including this structure guide.

## File Naming Conventions

- **TypeScript/JavaScript**: `camelCase.ts` or `PascalCase.tsx` (for components)
- **Python**: `snake_case.py`
- **Configuration**: `kebab-case.json` or `kebab-case.yml`
- **Documentation**: `UPPERCASE.md` for important docs, `lowercase.md` for guides

## Module Organization

Each module follows a consistent structure:
```
module/
├── __init__.py or index.ts
├── main logic files
├── tests/
└── README.md
```

## Import Paths

### Frontend (TypeScript)
```typescript
import { Button } from '@/components/common/Button';
import { useScan } from '@/hooks/useScans';
import type { Scan } from '@/types/scan';
```

### Backend (Python)
```python
from app.tools.recon import nmap_wrapper
from app.parsers import nmap_parser
from app.models import Scan
```

### AI Engine (Python)
```python
from app.agents import recon_agent
from app.knowledge import vector_store
from app.scoring import risk_scorer
```

## Build Artifacts (Not in Git)

```
frontend/
├── dist/              # Vite build output
├── out/               # Electron packaged apps
└── node_modules/

backend-sidecar/
├── __pycache__/
├── .pytest_cache/
└── venv/

ai-engine/
├── __pycache__/
├── .pytest_cache/
└── venv/
```

---

**Last Updated**: January 29, 2026
