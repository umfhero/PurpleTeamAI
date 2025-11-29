<div align="center">
  <img src="assets/Banner.png" alt="RedTeamAI Banner" width="100%" />

  # RedTeamAI
  
  **The Framework for AI-Powered Security Operations**

  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
  [![Python](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/)
  [![React](https://img.shields.io/badge/react-18-blue.svg)](https://reactjs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.95+-009688.svg)](https://fastapi.tiangolo.com/)
  [![Docker](https://img.shields.io/badge/docker-compose-2496ED.svg)](https://www.docker.com/)

  <p align="center">
    <a href="#features">Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#roadmap">Roadmap</a> •
    <a href="#contributing">Contributing</a>
  </p>
</div>

---

## 🛡️ What is RedTeamAI?

**RedTeamAI** is an advanced, all-in-one security suite designed to bridge the gap between offensive and defensive security operations using Artificial Intelligence. It integrates powerful reconnaissance tools, automated pentesting capabilities, and real-time defense mechanisms into a unified, module-based dashboard.

Built for security researchers, penetration testers, and blue teams, RedTeamAI leverages LLMs (Large Language Models) to analyze vulnerabilities, generate exploit chains, and suggest remediation strategies in real-time.

## ✨ Key Features

### 🔍 Recon Module
- **Asset Discovery**: Automated subdomain enumeration and port scanning.
- **Attack Surface Mapping**: Visual graph of discovered assets and relationships.
- **OSINT Integration**: Aggregates data from Shodan, theHarvester, and more.

### ⚔️ Pentesting Module
- **Vulnerability Scanning**: Integrates Nuclei and custom scripts.
- **Exploit Orchestration**: Maps findings to the MITRE ATT&CK framework.
- **AI Agent**: Identifies business logic flaws and suggests exploit paths.

### 🛡️ Defense Module
- **Threat Monitoring**: Real-time anomaly detection and log analysis.
- **Auto-Remediation**: AI-generated fix suggestions for identified vulnerabilities.
- **Hardening Checks**: Automated CIS benchmark compliance auditing.

### 🧠 AI Engine
- **Centralized Intelligence**: Context-aware analysis across all modules.
- **Risk Scoring**: Dynamic 0-10 risk calculation based on exploitability and impact.
- **Natural Language Reporting**: Generates human-readable security reports.

## 🏗️ Architecture

RedTeamAI follows a modern, microservices-inspired architecture:

- **Frontend**: React 18 + TypeScript + Vite (Dark-themed, responsive dashboard).
- **Backend**: FastAPI (Async Python) + SQLModel + PostgreSQL.
- **Task Queue**: Celery + Redis for long-running scans.
- **AI Integration**: Support for OpenAI, Gemini, and local Ollama models.
- **Infrastructure**: Dockerized environment for isolation and easy deployment.

## 🚀 Getting Started

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/)
- [Node.js 18+](https://nodejs.org/) (for local frontend dev)
- [Python 3.10+](https://www.python.org/) (for local backend dev)

### Quick Start (Docker)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/RedTeamAI.git
   cd RedTeamAI
   ```

2. **Set up Environment Variables**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your API keys and database credentials
   ```

3. **Start the Application**
   ```bash
   docker-compose up -d
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:8000`

### Manual Setup

See [Walkthrough](walkthrough.md) for detailed manual installation instructions.

## 🗺️ Roadmap

- [x] **Phase 1: Foundation** - Core architecture, DB, and Dashboard setup.
- [ ] **Phase 2: Recon Module** - Subdomain enumeration and port scanning integration.
- [ ] **Phase 3: Pentesting Module** - Vulnerability scanning and exploit chaining.
- [ ] **Phase 4: Defense Module** - Threat monitoring and remediation.
- [ ] **Phase 5: Integration & Polish** - Unified AI engine and reporting.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
