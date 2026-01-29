# PurpleTeamAI - Quick Start Guide

> **Setup guide for when implementation begins**  
> **Current Status**: Planning phase - use this guide as you build Phase 1

---

## Prerequisites

Before you begin, ensure you have the following installed:

- ✅ **Node.js** 18+ ([Download](https://nodejs.org/))
- ✅ **Python** 3.10+ ([Download](https://www.python.org/))
- ✅ **Git** ([Download](https://git-scm.com/))
- ✅ **Nmap** ([Download](https://nmap.org/download.html))
- ✅ **OpenAI API Key** or **Ollama** for local LLMs

### Optional Tools
- **Sublist3r**: `pip install sublist3r`
- **SQLMap**: `git clone https://github.com/sqlmapproject/sqlmap.git`
- **Ollama**: For local LLM support ([Download](https://ollama.ai/))

---

## Current Status

🚧 **This project is in the planning phase.** The code will be built following the roadmap in [TODO.md](./TODO.md).

This guide describes how to set up the project **once Phase 1 is implemented**.

---

## Installation (Future)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/PurpleTeamAI.git
cd PurpleTeamAI
```

### 2. Set Up Frontend (Electron + React)

**Note**: This will work once Phase 1 is complete.

```bash
cd frontend
npm install
```

### 3. Set Up Backend Sidecar (Python)

```bash
cd ../backend-sidecar
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 4. Set Up AI Engine (LangChain)

```bash
cd ../ai-engine
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

---

## Configuration

### 1. Backend Sidecar Configuration

```bash
cd backend-sidecar
cp .env.example .env
```

Edit `.env`:
```bash
SIDECAR_HOST=127.0.0.1
SIDECAR_PORT=8765
LOG_LEVEL=INFO

# Tool paths (adjust for your system)
NMAP_PATH=/usr/bin/nmap
SUBLIST3R_PATH=/usr/local/bin/sublist3r
SQLMAP_PATH=/path/to/sqlmap/sqlmap.py
```

### 2. AI Engine Configuration

```bash
cd ../ai-engine
cp .env.example .env
```

Edit `.env`:
```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key-here
DEFAULT_MODEL=gpt-4o

# OR Ollama Configuration (for local LLMs)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3

# Model Provider: 'openai' or 'ollama'
MODEL_PROVIDER=openai
```

### 3. Install Ollama (Optional - for local LLMs)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull Llama 3 model
ollama pull llama3

# Start Ollama server
ollama serve
```

---

## For Now: Start Building

Since this is a fresh project, **start with Phase 1 of TODO.md**:

1. **Initialize Electron Project**
   ```bash
   mkdir -p frontend/src/{main,preload,renderer}
   cd frontend
   npm init -y
   npm install electron electron-builder --save-dev
   npm install react react-dom
   ```

2. **Set Up Python Sidecar**
   ```bash
   mkdir -p backend-sidecar/app/{tools,parsers,ipc}
   cd backend-sidecar
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   pip install aiohttp pydantic python-nmap
   ```

3. **Follow TODO.md Phase 1** for detailed implementation steps

---

## Running the Application (Once Built)

### Development Mode

#### Option 1: Run All Components Separately

**Terminal 1 - Backend Sidecar:**
```bash
cd backend-sidecar
source venv/bin/activate  # or venv\Scripts\activate on Windows
python -m app.main
```

**Terminal 2 - AI Engine:**
```bash
cd ai-engine
source venv/bin/activate  # or venv\Scripts\activate on Windows
python -m app.main
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```

#### Option 2: Automated Startup (Recommended)

The Electron app will automatically start the Python sidecar:

```bash
cd frontend
npm run dev
```

The application will open automatically at `http://localhost:5173` (or in Electron window).

---

## First Steps

### 1. Configure Your First Target

1. Open PurpleTeamAI
2. Navigate to **Settings** → **Targets**
3. Add a target:
   - **Name**: Test Target
   - **IP/Domain**: scanme.nmap.org (safe test target)
   - **Description**: Test reconnaissance scan

### 2. Run Your First Scan

1. Go to **Reconnaissance** module
2. Select **Nmap Scan**
3. Configure scan:
   - **Target**: scanme.nmap.org
   - **Scan Type**: Quick Scan
   - **Ports**: 1-1000
4. Click **Start Scan**
5. Watch real-time progress
6. View results with AI analysis

### 3. Explore AI Insights

1. After scan completes, view the **AI Analysis** tab
2. See:
   - Risk score
   - OWASP Top 10 mapping
   - MITRE ATT&CK techniques
   - Remediation suggestions

---

## Verify Installation

### Check Backend Sidecar

```bash
curl http://localhost:8765/health
# Expected: {"status": "healthy", "version": "2.0.0"}
```

### Check AI Engine

```bash
curl http://localhost:8766/health
# Expected: {"status": "healthy", "model": "gpt-4o"}
```

### Check Nmap Installation

```bash
nmap --version
# Expected: Nmap version 7.x or higher
```

---

## Troubleshooting

### Issue: Python Sidecar Won't Start

**Solution 1**: Check Python version
```bash
python --version
# Should be 3.10 or higher
```

**Solution 2**: Verify dependencies
```bash
cd backend-sidecar
pip install -r requirements.txt --upgrade
```

### Issue: Electron App Won't Launch

**Solution 1**: Clear node_modules and reinstall
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Solution 2**: Check Node.js version
```bash
node --version
# Should be 18 or higher
```

### Issue: AI Engine Fails

**Solution 1**: Verify API key
```bash
# Test OpenAI API
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Solution 2**: Use Ollama instead
```bash
# Install and start Ollama
ollama serve

# Update ai-engine/.env
MODEL_PROVIDER=ollama
OLLAMA_MODEL=llama3
```

### Issue: Nmap Not Found

**Windows**:
```bash
# Add Nmap to PATH or specify full path in .env
NMAP_PATH=C:\Program Files (x86)\Nmap\nmap.exe
```

**macOS**:
```bash
brew install nmap
```

**Linux**:
```bash
sudo apt-get install nmap  # Debian/Ubuntu
sudo yum install nmap      # RHEL/CentOS
```

---

## Development Tips

### Hot Reload

The frontend supports hot reload - changes to React components will update automatically.

### Debug Mode

Enable debug logging:

**Backend Sidecar:**
```bash
# backend-sidecar/.env
LOG_LEVEL=DEBUG
```

**Electron:**
```bash
# Open DevTools
Ctrl+Shift+I (Windows/Linux)
Cmd+Option+I (macOS)
```

### Testing Tools Individually

**Test Nmap Wrapper:**
```bash
cd backend-sidecar
python -c "from app.tools.recon.nmap_wrapper import scan; print(scan('scanme.nmap.org'))"
```

**Test AI Agent:**
```bash
cd ai-engine
python -c "from app.agents.vulnerability_agent import VulnerabilityAgent; agent = VulnerabilityAgent(); print(agent.analyze([]))"
```

---

## Next Steps

Now that you're set up, explore the modules:

1. 📖 Read [TODO.md](./TODO.md) for the implementation roadmap
2. 🏗️ Review [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details
3. 🔍 Start with the **Reconnaissance Module** (Phase 2)
4. 🔴 Move to **Pentesting Module** (Phase 3)
5. 🔵 Implement **Defense Module** (Phase 4)
6. 🤖 Enhance **AI Engine** (Phase 5)

---

## Useful Commands

### Frontend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run linter
npm run test         # Run tests
```

### Backend Sidecar
```bash
python -m app.main              # Start sidecar
python -m pytest                # Run tests
python -m pytest --cov          # Run tests with coverage
```

### AI Engine
```bash
python -m app.main              # Start AI engine
python -m pytest                # Run tests
```

---

## Getting Help

- 📚 **Documentation**: Check the `/docs` folder
- 🐛 **Issues**: Open an issue on GitHub
- 💬 **Discussions**: Join the discussions tab
- 📧 **Email**: [your-email@example.com]

---

## Project Structure Quick Reference

```
PurpleTeamAI/
├── frontend/           # Electron + React UI
├── backend-sidecar/    # Python execution layer
├── ai-engine/          # LangChain reasoning layer
├── shared/             # Shared types and schemas
└── docs/               # Documentation
```

---

## Security Notice

⚠️ **Important**: This tool is for authorized security testing only. Always:
- Get written permission before scanning
- Use on your own systems or authorized targets
- Follow responsible disclosure practices
- Comply with local laws and regulations

---

## License

[Add your license here]

---

**Happy Hacking! 🛡️🔐**

For detailed implementation steps, see [TODO.md](./TODO.md)
