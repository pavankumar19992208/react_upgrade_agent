# 🚀 React Dependency Upgrade Assistant

[![Build Status](https://img.shields.io/github/actions/workflow/status/YOUR_USER/YOUR_REPO/main.yml?branch=main)](https://github.com/YOUR_USER/YOUR_REPO/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](/LICENSE)

Welcome to the AI‑Powered React Dependency Upgrade Assistant: automate detection of outdated/deprecated packages and generate code-level refactor suggestions using Gemini 2.5 Pro.

---

## 📸 Demo Screenshot


::contentReference[oaicite:0]{index=0}


*(Above: Upload a React project ZIP, check logs, and view status)*

---

## 🛠️ Features

- Zip upload of React project (excludes `node_modules`)
- Detect outdated & deprecated npm packages
- Prioritize updates: **High**, **Medium**, **Low**
- Generate refactor suggestions via **Gemini 2.5 Pro**
- Log every step in local JSON files (`./logs/exec-<id>.json`)
- Build-ready for test execution and audit

---

## 🧩 Tech Stack

| Component     | Technology          |
|---------------|---------------------|
| Frontend      | React + Vite        |
| Backend       | FastAPI (Python)    |
| LLM           | Gemini 2.5 Pro via Vertex AI |
| Logs Storage  | JSON files locally  |

---

## 📦 Setup

### 1. Clone the repo  
```bash
git clone https://github.com/YOUR_USER/YOUR_REPO.git
2. Frontend
bash
Copy
Edit
cd frontend
npm install
npm run dev
3. Backend
bash
Copy
Edit
cd backend
pip install -r requirements.txt
export GEMINI_API_KEY=your_key_here
uvicorn main:app --reload --port 8000
🚀 Usage
Zip your React project (excluding node_modules)

Upload via frontend UI, which sends { executionId, dependencies }

Backend logs payload, checks npm, calls Gemini, and saves suggestions

Logs available in ./logs/exec-<executionId>.json

🧠 How It Works
Uses npm registry to fetch latest versions and deprecation metadata

Assigns priority:

High = deprecated dependencies

Medium = major version updates

Low = minor/patch updates

Gemini prompt:

yaml
Copy
Edit
Outdated dependencies:
- pkg1: current → latest
- pkg2: current → latest
Please suggest code-level refactor advice.
Logs generated suggestions under "step": "Gemini suggestion"

📈 Next Steps
Run tests (Vitest/Jest), capture results

Frontend polling for real-time logs display

Downloadable logs archive

GitHub auto pull requests via LLM

🔧 Frontend Structure
Add a dedicated frontend/README.md for details:

markdown
Copy
Edit
# Frontend

## Features
- Upload .zip file (React project)
- Extract dependencies via JSZip
- Generate UUID as executionId

## Usage
```bash
npm install
npm run dev
Go to http://localhost:3000 and upload your .zip file!

yaml
Copy
Edit

*(This should live inside your `frontend/` folder.)*

---

## 📄 License

MIT © [Your Name]

---

### ❤️ Contribute

PRs, feature suggestions, or questions are welcome!
::contentReference[oaicite:1]{index=1}
