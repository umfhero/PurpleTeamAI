# PurpleTeamAI - Technical Architecture

> **Version**: 2.0  
> **Architecture Pattern**: Multi-Tiered Sidecar  
> **Last Updated**: January 29, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Layers](#architecture-layers)
3. [Communication Flow](#communication-flow)
4. [Security Design](#security-design)
5. [Data Pipeline](#data-pipeline)
6. [Technology Stack](#technology-stack)
7. [Deployment Model](#deployment-model)

---

## Overview

PurpleTeamAI implements a **Multi-Tiered Sidecar Architecture** that separates concerns across three distinct layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER                       │
│              Electron.js + React + Tailwind                  │
│                  (User Interface & IPC)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │ Secure IPC Bridge
                       │ (Context Isolation)
┌──────────────────────▼──────────────────────────────────────┐
│                    EXECUTION LAYER                           │
│                    Python Sidecar                            │
│         (Nmap, Sublist3r, Scapy, SQLMap, etc.)              │
└──────────────────────┬──────────────────────────────────────┘
                       │ JSON-RPC / REST
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    REASONING LAYER                           │
│              LangChain + GPT-4o/Ollama                       │
│         (Semantic Analysis & Intelligence)                   │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Security-by-Design**: Context isolation prevents code injection
2. **Separation of Concerns**: Each layer has a single responsibility
3. **LLM-First**: All data is normalized for AI consumption
4. **Modularity**: Components are independently testable and replaceable
5. **Performance**: Async operations prevent UI blocking

---

## Architecture Layers

### 1. Orchestration Layer (Electron + React)

**Purpose**: User interface and process orchestration

**Components**:
- **Main Process** (Node.js)
  - Window management
  - Python sidecar lifecycle
  - IPC message routing
  - File system operations
  - System tray integration

- **Renderer Process** (React)
  - Dashboard UI
  - Real-time data visualization
  - User input handling
  - State management (React Query)

- **Preload Script** (Secure Bridge)
  - Exposes safe APIs to renderer
  - Input validation
  - Message sanitization

**Technology**:
- Electron.js (latest)
- React 18 + TypeScript
- Tailwind CSS
- Vite (build tool)
- React Router (navigation)
- Recharts (visualization)

---

### 2. Execution Layer (Python Sidecar)

**Purpose**: System-level security tool execution

**Components**:
- **Tool Wrappers**
  - Nmap scanner
  - Sublist3r enumerator
  - Scapy packet crafter
  - SQLMap injector
  - Custom scanners

- **Data Parsers**
  - XML to JSON (Nmap)
  - Raw text normalizers
  - LLM-ready formatters

- **IPC Server**
  - Socket/HTTP server
  - Request queue
  - Response streaming
  - Health monitoring

**Technology**:
- Python 3.10+
- asyncio (async operations)
- aiohttp (HTTP server)
- python-nmap (Nmap wrapper)
- scapy (packet manipulation)
- pydantic (data validation)

---

### 3. Reasoning Layer (AI Engine)

**Purpose**: Intelligent analysis and decision-making

**Components**:
- **LangChain Agents**
  - Reconnaissance analyzer
  - Vulnerability assessor
  - Threat detector
  - Remediation suggester

- **Knowledge Base**
  - OWASP Top 10 database
  - MITRE ATT&CK framework
  - CVE database
  - Remediation patterns

- **Scoring Engine**
  - Risk calculation
  - Priority ranking
  - Trend analysis

- **Report Generator**
  - Natural language summaries
  - Executive reports
  - Technical deep-dives

**Technology**:
- LangChain
- OpenAI GPT-4o
- Ollama (Llama 3)
- ChromaDB (vector store)
- Pandas (data analysis)

---

## Communication Flow

### IPC Bridge (Electron ↔ Python)

```typescript
// Renderer Process (React)
const result = await window.electronAPI.runScan({
  type: 'nmap',
  target: '192.168.1.0/24',
  options: { ports: '1-1000' }
});

// Preload Script (Secure Bridge)
contextBridge.exposeInMainWorld('electronAPI', {
  runScan: (params) => ipcRenderer.invoke('run-scan', sanitize(params))
});

// Main Process (Electron)
ipcMain.handle('run-scan', async (event, params) => {
  validate(params);
  return await pythonSidecar.execute(params);
});
```

### Python Sidecar Communication

```python
# Python Sidecar Server
@app.post("/api/scan")
async def run_scan(request: ScanRequest):
    # Execute tool
    result = await nmap_wrapper.scan(
        target=request.target,
        ports=request.options.ports
    )
    
    # Normalize for LLM
    normalized = parser.to_llm_format(result)
    
    # Send to AI engine
    analysis = await ai_engine.analyze(normalized)
    
    return {
        "raw": result,
        "normalized": normalized,
        "analysis": analysis
    }
```

### AI Engine Integration

```python
# LangChain Agent
from langchain.agents import create_openai_functions_agent
from langchain.prompts import ChatPromptTemplate

agent = create_openai_functions_agent(
    llm=ChatOpenAI(model="gpt-4o"),
    tools=[vulnerability_mapper, risk_scorer],
    prompt=security_analysis_prompt
)

result = agent.invoke({
    "input": normalized_scan_data,
    "context": "OWASP Top 10 mapping"
})
```

---

## Security Design

### Context Isolation

```javascript
// Main Process Configuration
const mainWindow = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,        // ✅ Enabled
    nodeIntegration: false,        // ✅ Disabled
    sandbox: true,                 // ✅ Enabled
    preload: path.join(__dirname, 'preload.js')
  }
});
```

**Benefits**:
- Prevents RCE from malicious tool outputs
- Isolates renderer from Node.js APIs
- Enforces explicit API exposure

### Input Validation

```typescript
// Preload Script
function sanitize(input: unknown): ScanParams {
  const schema = z.object({
    type: z.enum(['nmap', 'sublist3r', 'sqlmap']),
    target: z.string().ip().or(z.string().url()),
    options: z.record(z.string())
  });
  
  return schema.parse(input); // Throws if invalid
}
```

### Process Sandboxing

```python
# Python Sidecar - Tool Execution
import subprocess
import shlex

def execute_tool(command: str, timeout: int = 300):
    # Sanitize command
    safe_cmd = shlex.split(command)
    
    # Run in isolated process
    result = subprocess.run(
        safe_cmd,
        capture_output=True,
        timeout=timeout,
        check=False,
        env=minimal_env  # Restricted environment
    )
    
    return result.stdout.decode()
```

### Credential Management

```typescript
// Secure Storage (Electron)
import { safeStorage } from 'electron';

function storeAPIKey(key: string) {
  const encrypted = safeStorage.encryptString(key);
  store.set('api_key', encrypted.toString('base64'));
}

function getAPIKey(): string {
  const encrypted = Buffer.from(store.get('api_key'), 'base64');
  return safeStorage.decryptString(encrypted);
}
```

---

## Data Pipeline

### LLM-Ready Normalization

All tool outputs are converted to a unified schema:

```typescript
interface NormalizedScanResult {
  metadata: {
    tool: string;
    version: string;
    timestamp: string;
    target: string;
    duration: number;
  };
  findings: Finding[];
  summary: {
    total_hosts: number;
    open_ports: number;
    vulnerabilities: number;
  };
  raw_output?: string;
}

interface Finding {
  id: string;
  type: 'port' | 'vulnerability' | 'subdomain' | 'service';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  evidence: string;
  remediation?: string;
  references?: string[];
  cvss_score?: number;
  owasp_category?: string;
  mitre_tactics?: string[];
}
```

### Data Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   Tool   │────▶│  Parser  │────▶│   AI     │────▶│   UI     │
│  Output  │     │ (Normalize)    │  Engine  │     │ Display  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
   (Raw)         (Structured)      (Analyzed)      (Visualized)
```

---

## Technology Stack

### Frontend Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| Electron.js | Desktop framework | Latest |
| React | UI library | 18+ |
| TypeScript | Type safety | 5+ |
| Tailwind CSS | Styling | 4+ |
| Vite | Build tool | 7+ |
| React Router | Navigation | 7+ |
| React Query | State management | 5+ |
| Recharts | Data visualization | 3+ |
| Lucide React | Icons | Latest |

### Backend Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| Python | Runtime | 3.10+ |
| aiohttp | HTTP server | Latest |
| pydantic | Data validation | 2+ |
| python-nmap | Nmap wrapper | Latest |
| scapy | Packet manipulation | Latest |
| sqlmap | SQL injection | Latest |

### AI Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| LangChain | LLM orchestration | Latest |
| OpenAI | GPT-4o API | Latest |
| Ollama | Local LLMs | Latest |
| ChromaDB | Vector database | Latest |
| Pandas | Data analysis | Latest |

---

## Deployment Model

### Development

```bash
# Terminal 1: Frontend
cd frontend
npm run dev

# Terminal 2: Python Sidecar (auto-started by Electron)
# No manual start needed
```

### Production Build

```bash
# Build Electron app
cd frontend
npm run build

# Package for distribution
npm run package:win   # Windows
npm run package:mac   # macOS
npm run package:linux # Linux
```

### Distribution

- **Windows**: NSIS installer (.exe)
- **macOS**: DMG image (.dmg)
- **Linux**: AppImage (.appimage) or deb package

### Auto-Update

```typescript
import { autoUpdater } from 'electron-updater';

autoUpdater.checkForUpdatesAndNotify();
```

---

## Performance Considerations

### Async Operations

- All tool executions are async to prevent UI blocking
- Progress updates via streaming responses
- Cancellable operations

### Memory Management

- Lazy loading of large datasets
- Pagination for results
- Cleanup of completed scans

### Optimization

- Debounced user inputs
- Memoized React components
- Indexed database queries
- Compressed data transfer

---

## Monitoring & Logging

### Application Logs

```typescript
import log from 'electron-log';

log.info('Scan started:', scanId);
log.error('Scan failed:', error);
```

### Performance Metrics

- Scan duration tracking
- Memory usage monitoring
- API call latency
- AI inference time

### Error Reporting

- Crash reports (Sentry)
- User feedback system
- Debug logs for troubleshooting

---

## Future Architecture Enhancements

1. **Microservices**: Split Python sidecar into multiple services
2. **Message Queue**: Add RabbitMQ for better async handling
3. **Distributed Scanning**: Multi-node scanning architecture
4. **Cloud Integration**: AWS/Azure deployment options
5. **GraphQL API**: Replace REST with GraphQL
6. **WebAssembly**: Move parsers to WASM for performance

---

**Document Version**: 2.0  
**Last Updated**: January 29, 2026  
**Maintained By**: [Your Name]
