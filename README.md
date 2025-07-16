# 🚀 React Dependency Upgrade Assistant

A powerful full-stack tool to automate React project dependency upgrades, powered by Gemin 2.5 Pro!

---

## ✨ Features

- 📦 **Upload a zipped React project** (without `node_modules`)
- 🔍 **Detect outdated & deprecated npm packages**
- ⚠️ **Prioritize updates** (High / Medium / Low)
- 🤖 **Gemini 2.5 Pro refactor suggestions** for code improvements
- 📝 **Logs each step** (JSON) for transparency & auditing
- ⚙️ **Ready for testing** and final review

---

## 🧩 Technology Stack

- **Frontend**: React + Vite, file upload, JSZip parsing
- **Backend**: Python + FastAPI
- **LLM**: Gemini 2.5 Pro via Google Vertex AI
- **Storage**: Local JSON logs (`./logs/exec-<executionId>.json`)

---

## 📦 Getting Started

### 1. Clone & Install
```bash
git clone <your‑repo‑url>
cd react-upgrade-agent
Frontend Setup
bash
Copy
Edit
cd frontend
npm install
npm run dev
Backend Setup
bash
Copy
Edit
cd backend
pip install -r requirements.txt
export GEMINI_API_KEY=<your_key>
uvicorn main:app --reload
🚀 Usage
Zip your React project (exclude node_modules)

Upload via frontend UI

Frontend sends { executionId, dependencies } to backend

Backend logs steps, checks npm, and calls Gemini for refactor suggestions

Logs saved as ./logs/exec-<executionId>.json

🧠 Tech Details
Uses npmjs.org registry to fetch latest version & deprecation info

Prioritizes updates:

High = deprecated packages

Medium = major version gap

Low = minor/patch updates

Builds a prompt listing outdated dependencies

Gemini returns code-level refactor suggestions added to logs

🔭 Roadmap
 Run tests (Vitest, Jest) and log results

 Frontend log polling & live UI

 Optional logs download/archive

 LLM-powered auto-pull-requests via GitHub API

💡 Why This?
Maintaining React projects can be time-consuming and error-prone. This tool automates detection, prioritization, and code guidance—helping you confidently update your dependencies with AI-powered insights.

🚧 Contributions & Feedback
PRs and feature ideas are welcome!
Found a bug or want support? Create an issue.

🔒 License
Distributed under the MIT License. See LICENSE for details.

yaml
Copy
Edit

---

### ✅ Tips:
- Replace `<your‑repo‑url>` with your actual GitHub link.
- Add a `requirements.txt` and `frontend/README.md` as needed.
- Consider adding badges (CI build, license, code coverage) to enhance readability.

Let me know if you'd like help adding visuals, CI integration, or live log preview instructions!
::contentReference[oaicite:0]{index=0}
