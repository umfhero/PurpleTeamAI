# PurpleTeamAI

**The Framework for AI-Powered Security Operations**

PurpleTeamAI is a comprehensive security suite that I've been working on. It's designed to bring together both offensive and defensive security operations using Artificial Intelligence. The idea is to bridge the gap between the red team (attackers) and the blue team (defenders), which is why I've called it PurpleTeamAI. It's not just about attacking; it covers reconnaissance, pentesting, and active defence, all in one dashboard.

I built this for security researchers and anyone interested in seeing how AI can help with vulnerability analysis and remediation. It uses Large Language Models (LLMs) to help understand security flaws and suggest how to fix them.

## Key Features

### Recon Module
This part handles the initial information gathering. It does things like automated subdomain enumeration and port scanning. It also maps out the attack surface so you can see what assets are exposed. I've also integrated some OSINT tools to pull in data from other sources.

### Pentesting Module
This is the offensive side. It integrates vulnerability scanners and can help map findings to the MITRE ATT&CK framework. There's an AI agent that tries to identify logic flaws and suggest potential ways an attacker might get in.

### Defense Module
This is the defensive side. It's meant for monitoring threats and analysing logs in real-time. The cool part is the auto-remediation, where the AI suggests fixes for the vulnerabilities it finds. It also checks for compliance with security benchmarks.

### AI Engine
This is the brain of the operation. It analyses data from all the other modules to give a better picture of the security posture. It calculates risk scores and can generate reports in plain English, so you don't have to decipher raw logs.

## Architecture

I've used a modern tech stack for this project:

- **Frontend**: React 18 with TypeScript and Vite. I've gone for a dark-themed dashboard.
- **Backend**: FastAPI (Python) with PostgreSQL for the database.
- **Task Queue**: Celery and Redis to handle the long-running scans.
- **AI Integration**: It supports OpenAI, Gemini, and local models via Ollama.
- **Infrastructure**: Everything is dockerised so it's easy to spin up.

## Getting Started

### Prerequisites
You'll need Docker and Docker Compose installed. If you want to run it locally without Docker, you'll need Node.js and Python installed.

### Quick Start (Docker)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/PurpleTeamAI.git
   cd PurpleTeamAI
   ```

2. **Set up Environment Variables**
   ```bash
   cp backend/.env.example backend/.env
   # You'll need to edit backend/.env with your API keys and database details
   ```

3. **Start the Application**
   ```bash
   docker-compose up -d
   ```
   - The frontend will be at `http://localhost:5173`
   - The backend API will be at `http://localhost:8000`

### Manual Setup

If you prefer to set it up manually, have a look at the `walkthrough.md` file for more detailed instructions.

## Roadmap

- [x] **Phase 1: Foundation** - Setting up the core architecture, database, and dashboard.
- [ ] **Phase 2: Recon Module** - Integrating the scanning tools.
- [ ] **Phase 3: Pentesting Module** - Adding vulnerability scanning.
- [ ] **Phase 4: Defense Module** - Implementing threat monitoring and remediation.
- [ ] **Phase 5: Integration & Polish** - Tying it all together with the AI engine.

## Contributing

If you want to help out, feel free to submit a Pull Request. I'm open to contributions!

1. Fork the Project
2. Create your Feature Branch
3. Commit your Changes
4. Push to the Branch
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.
