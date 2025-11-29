<div align="center">
  <img src="assets/Banner.png" alt="PurpleTeamAI Banner" width="100%" />

  # PurpleTeamAI
  
  **The Framework for AI Powered Security Operations**


  ![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
  ![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
  ![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
  ![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
  ![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
  ![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
  ![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)
  ![Celery](https://img.shields.io/badge/celery-%2337814A.svg?style=for-the-badge&logo=celery&logoColor=white)
  ![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
  ![OpenAI](https://img.shields.io/badge/OpenAI-412991.svg?style=for-the-badge&logo=OpenAI&logoColor=white)



</div>


> [!IMPORTANT]
> **Dissertation Project**: This application is being developed as part of a final year dissertation for the Cybersecurity and Digital Forensics course.

PurpleTeamAI is a comprehensive security suite that I am developing for this project. The aim is to combine reconnaissance, red teaming (offensive), and blue teaming (defensive) operations into a single, unified application—creating a complete 'Purple Team' suite.

This project bridges the gap between attackers and defenders by integrating these distinct disciplines into one dashboard. It is not just about attacking; it covers the entire lifecycle from reconnaissance to pentesting and active defence. I am designing this for security researchers to demonstrate how Artificial Intelligence can assist with vulnerability analysis and remediation, utilising Large Language Models (LLMs) to identify security flaws and suggest real time fixes.

## Key Features

### Recon Module
This part handles the initial information gathering. It performs tasks like automated subdomain enumeration and port scanning. It also maps out the attack surface so you can see what assets are exposed. I am also integrating some OSINT tools to pull in data from other sources.

### Pentesting Module
This is the offensive side. It integrates vulnerability scanners and can help map findings to the MITRE ATT&CK framework. There's an AI agent that tries to identify logic flaws and suggest potential ways an attacker might get in.

### Defense Module
This is the defensive side. It's meant for monitoring threats and analysing logs in real time. The cool part is the auto remediation, where the AI suggests fixes for the vulnerabilities it finds. It also checks for compliance with security benchmarks.

### AI Engine
This is the brain of the operation. It analyses data from all the other modules to give a better picture of the security posture. It calculates risk scores and can generate reports in plain English, so you don't have to decipher raw logs.

---

## Roadmap

- [x] **Phase 1: Foundation** - Setting up the core architecture, database, and dashboard.
- [ ] **Phase 2: Recon Module** - Integrating the scanning tools.
- [ ] **Phase 3: Pentesting Module** - Adding vulnerability scanning.
- [ ] **Phase 4: Defense Module** - Implementing threat monitoring and remediation.
- [ ] **Phase 5: Integration & Polish** - Tying it all together with the AI engine.

## Architecture

I am using a modern tech stack for this project:

- **Frontend**: React 18 with TypeScript and Vite. I am using a dark themed dashboard.
- **Backend**: FastAPI (Python) with PostgreSQL for the database.
- **Task Queue**: Celery and Redis to handle the long running scans.
- **AI Integration**: It supports OpenAI, Gemini, and local models via Ollama.
- **Infrastructure**: Everything is dockerised so it's easy to spin up.

## Installation

To run the application locally:

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    ```

2.  **Configuration**
    Copy the example environment file and configure the necessary credentials:
    ```bash
    cp backend/.env.example backend/.env
    ```

3.  **Run with Docker**
    ```bash
    docker-compose up -d
    ```
    - Frontend: `http://localhost:5173`
    - Backend API: `http://localhost:8000`
