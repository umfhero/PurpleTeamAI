# PurpleTeamAI

**Automating the Purple Team Lifecycle: An Integrated Framework for AI-Assisted Vulnerability Discovery and Autonomous Remedy**

![Electron](https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-886FBF?style=for-the-badge&logo=googlegemini&logoColor=white)
![Nmap](https://img.shields.io/badge/Nmap-4682B4?style=for-the-badge&logo=nmap&logoColor=white)

[![Node.js](https://img.shields.io/badge/node.js-18+-339933.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-19-blue.svg)](https://reactjs.org/)
[![Electron](https://img.shields.io/badge/electron-latest-47848F.svg)](https://www.electronjs.org/)
[![Gemini API](https://img.shields.io/badge/gemini-api-886FBF.svg)](https://ai.google.dev/)

</div>

---

## About

PurpleTeamAI is a dissertation project that addresses a critical gap in modern application security workflows. As organizations increasingly adopt rapid development practices like "vibe coding" and AI-assisted development, they accelerate software delivery but simultaneously introduce common security weaknesses that often go undetected until production.

**Purple teaming** — the collaborative security approach that combines offensive red team validation with defensive blue team priorities — offers a solution by continuously testing detection capabilities and response effectiveness. However, traditional purple team operations suffer from significant operational friction: manual triage of security findings creates bottlenecks, vulnerability scanners produce noisy outputs that require expert interpretation, and remediation guidance is often inconsistent or too generic to be immediately actionable by development teams.

This project proposes and implements an integrated framework that automates critical segments of the purple team lifecycle. The system orchestrates reconnaissance and vulnerability scanning tasks, collects raw security data, and leverages large language models to transform technical scan outputs into structured, actionable intelligence.

---

## Key Capabilities

The framework performs four core operations:

1. **Vulnerability Condensation** — Condenses verbose scanner results into clear vulnerability statements
2. **Endpoint Identification** — Identifies affected endpoints and code paths
3. **Contextual Severity Assessment** — Assesses severity ratings based on context
4. **Remediation Guidance** — Generates specific, actionable remediation guidance tailored to each finding

Additionally, the system maps all discovered vulnerabilities to **OWASP Top 10** categories, providing security teams with coverage metrics that highlight gaps in their defensive posture.

---

## Architecture

The implementation consists of a cross-platform **Electron** desktop application with a **React**-based user interface, backed by a **Node.js** runtime that orchestrates security tooling.

### Scanning Pipeline

```
Nmap Reconnaissance → JSON Normalization → LLM Analysis (Gemini API) → Structured Report
```

1. **Nmap** performs initial reconnaissance and vulnerability scanning
2. Outputs are processed and normalized into structured **JSON** format
3. Structured data is passed to the **LLM analysis module** powered by Google's Gemini API (with fallback support for local Ollama models)
4. The application produces condensed security reports integrating scan findings, vulnerability classifications, and prioritized remediation steps

### Technology Stack

| Layer              | Technology                                           |
| ------------------ | ---------------------------------------------------- |
| **Desktop Shell**  | Electron.js                                          |
| **User Interface** | React 19, TypeScript, Tailwind CSS                   |
| **Build Tooling**  | Vite                                                 |
| **Scanning**       | Nmap                                                 |
| **LLM Analysis**   | Google Gemini API (primary), Ollama (local fallback) |
| **Output Format**  | Structured JSON, condensed security reports          |

---

## Project Structure

```
PurpleTeamAI/
├── frontend/                  # Electron + React application
│   ├── src/
│   │   ├── components/        # React UI components
│   │   ├── pages/             # Application pages
│   │   ├── lib/               # Utilities and helpers
│   │   ├── App.tsx            # Root application component
│   │   └── main.tsx           # Application entry point
│   ├── public/                # Static assets
│   ├── package.json           # Dependencies and scripts
│   └── vite.config.ts         # Vite build configuration
│
├── assets/                    # Project assets (banners, images)
├── .gitignore
└── README.md
```

> **Note**: The Electron main process, preload scripts, and scanning/LLM modules will be added as development progresses.

---

## Development Environment

- **OS**: Windows 11 with Kali Linux virtual machines for security-focused tooling
- **Containers**: Docker for local deployment of intentionally vulnerable applications
- **Testing Targets**: [testphp.vulnweb.com](http://testphp.vulnweb.com) and locally deployed Mutillidae instances

### Prerequisites

- **Node.js** 18+ and npm
- **Git**
- **Nmap** ([download](https://nmap.org/download.html))
- **Google Gemini API Key** ([get one](https://ai.google.dev/)) or **Ollama** ([download](https://ollama.ai/)) for local LLMs
- **Docker** (for running vulnerable test targets locally)

### Getting Started

```bash
# Clone the repository
git clone <repository-url>
cd PurpleTeamAI

# Install frontend dependencies
cd frontend
npm install

# Start the development server
npm run dev
```

---

## Ethical Considerations

All testing activities are **strictly confined to authorized environments**:

- Testing is performed exclusively against publicly available vulnerable training platforms ([testphp.vulnweb.com](http://testphp.vulnweb.com)) and locally deployed instances of **Mutillidae** running in isolated Docker containers
- **No personal data** is collected, stored, or processed — all outputs are limited to technical scan results and vulnerability metadata
- Safe operating procedures are documented to prevent accidental scanning of unauthorized targets
- The codebase includes safeguards such as **target allowlists** and **user confirmation prompts** before initiating any scanning activities

---

## Evaluation Methodology

The framework is evaluated using three complementary metrics:

### Classification Correctness

Measures the system's ability to accurately identify vulnerabilities by comparing detected findings against ground-truth expectations from training targets with known vulnerabilities, calculating true positive and false positive rates.

### Remediation Suggestion Quality

Scored using a structured rubric evaluating:

- **Completeness** — Does the guidance address the root cause?
- **Accuracy** — Is the technical advice correct?
- **Actionability** — Can a developer apply it without additional research?
- **Relevance** — Is it specific to the vulnerability context?

### OWASP Category Coverage

Tracks how comprehensively the framework identifies vulnerabilities across the OWASP Top 10 classification system, revealing systematic gaps in detection capabilities.

---

## Project Timeline

This project spans **10 weeks** from development start to final submission (April 24, 2026):

| Week                 | Focus                                                                             |
| -------------------- | --------------------------------------------------------------------------------- |
| **Week 1** (Feb 9)   | Foundation — Electron shell, Nmap verified, Mutillidae in Docker                  |
| **Week 2** (Feb 16)  | Scanning pipeline — target input, Nmap orchestration, JSON normalization          |
| **Week 3** (Feb 23)  | Results dashboard — vulnerability table, scan history, literature review complete |
| **Week 4** (Mar 2)   | LLM integration — Gemini API analysis, remediation guidance                       |
| **Week 5** (Mar 9)   | OWASP mapping + security score (0–100%)                                           |
| **Week 6** (Mar 16)  | Report export + UI polish (brutalist design system)                               |
| **Week 7** (Mar 23)  | Testing both targets, Ollama fallback, accuracy validation                        |
| **Week 8** (Mar 30)  | Evaluation metrics — classification, remediation quality, OWASP coverage          |
| **Week 9** (Apr 6)   | Dissertation writing + screencast recording                                       |
| **Week 10** (Apr 13) | Final polish + submission (deadline: April 24)                                    |


---

## Acknowledgements

Built to advance the field of automated security operations and collaborative purple team workflows. This research contributes practical knowledge to both cybersecurity and software engineering domains by demonstrating that large language models can effectively bridge the gap between raw security scanner output and actionable remediation guidance.

---

**Status**: In Active Development
**Last Updated**: February 2026
