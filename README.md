# 🤖 Enterprise Dual-Mode AI Chatbot System

An enterprise-grade, retrieval-augmented generation (RAG) assistant developed for **Tradewinds Plantation Berhad**. The system provides 24/7 public inquiries for website visitors while offering a secure, authenticated self-service portal for internal staff to query policies, leave procedures, and IT compliance standards without risking confidential data leaks.

---

## 🌟 Key Highlights

- **Dual-Mode Access Architecture**: 
  - **Public Mode**: Serves general company information (profile, sustainability, career openings). Actively blocks questions regarding internal operations to prevent confidential data leaks.
  - **Employee Mode**: Requires Staff ID verification. Provides authorized employees with access to internal HR rules, leave entitlements, and IT security policies.
- **Ultra-Fast Local Inference**: Optimized document chunking and context budgeting to reduce response times from ~15–30s down to **~2–3s**.
- **Document Governance & Compliance**: Automatically extracts and displays ISO-compliant source cards (Document Title, Doc No, Revision, Effective Date) and executive sign-off signatories (Written By, Reviewed By, Approved By).
- **Dynamic Table Formatting**: Renders complex policy schedules (such as backup retention schedules) into clean, responsive HTML tables.
- **Zero-Friction Website Integration**: Lightweight web widget designed for 5-minute integration into CMS platforms (e.g., WordPress) via a single script tag.

---

## 🏗️ Architecture & Workflow

```text
┌────────────────────────────────────────────────────────┐
│             Corporate Website / Client App             │
└───────────────────────────┬────────────────────────────┘
                            │ API Request (Public / Employee Mode)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   FastAPI Backend                      │
├───────────────────────────┬────────────────────────────┤
│  Role-Based Access Guard  │  Validates Staff ID & Mode │
├───────────────────────────┼────────────────────────────┤
│  Knowledge Retrieval      │  Paragraph Chunking & Rank │
├───────────────────────────┼────────────────────────────┤
│  Prompt Engine            │  Injects ISO-Source Data   │
└───────────────────────────┬────────────────────────────┘
                            │ Structured Context
                            ▼
┌────────────────────────────────────────────────────────┐
│         Local AI Inference (Google Gemma 3:4b)         │
│                 Powered by Ollama                      │
└────────────────────────────────────────────────────────┘


🛠️ Tech Stack & Tools
Frontend: Vanilla JavaScript (ES6+), HTML5, Tailwind CSS
Backend: Python 3.10+, FastAPI, Uvicorn
AI / Local LLM: Ollama, Google Gemma 3 (4B parameters)
Data Processing: Custom Paragraph Chunking Pipeline (ChromaDB-ready)
Security: Role-Based Access Control (RBAC), Session Isolation, Data Leak Prevention

🚀 Getting Started
1. Prerequisites
Python 3.10+ installed.
Ollama installed and running on your local machine.

Pull the Gemma 3 (4B) model via your terminal:

ollama pull gemma3:4b
ollama run gemma3:4b

2. Clone the Repository
git clone https://github.com/naing9-city/AI-Chatbot-.git
cd AI-Chatbot-


3. Set Up Virtual Environment & Dependencies
python -m venv venv

Activate the environment:

On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
On Linux / macOS:
source venv/bin/activate

Install dependencies:

pip install -r requirements.txt

4. Configure Knowledge Base Documents

Place your text files (.txt) in their respective knowledge folders:

backend/knowledge/public/ — General public company information.
backend/knowledge/employee/ — Internal policies (IT security, leave applications, employment manuals).

(Note: Proprietary company documents are excluded from this repository for privacy compliance).

5. Run the Backend Server
uvicorn backend.main:app --reload --port 8000

The FastAPI documentation will be accessible at http://127.0.0.1:8000/docs
.

6. Launch the Frontend

Open frontend/index.html in your web browser, or serve it using any local static file server (e.g., Live Server in VS Code).

