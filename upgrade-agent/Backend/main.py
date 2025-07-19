from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Dict, List, Literal, Optional
import time

from fastapi.middleware.cors import CORSMiddleware
import os, json, requests, base64, re, sys, shutil, tempfile, subprocess, asyncio
from datetime import datetime

# Add Windows compatibility for asyncio subprocesses
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# Directory for storing logs
LOG_DIR = "./logs"
os.makedirs(LOG_DIR, exist_ok=True)

# FastAPI instance
app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# ---------------------------
# Pydantic Models
# ---------------------------

class Dependency(BaseModel):
    name: str
    version: str

class DeprecatedDep(BaseModel):
    name: str
    current: str
    latest: str
    priority: Literal["Must have", "Should have", "Could have", "Won't have"]

class UploadPayload(BaseModel):
    executionId: str
    dependencies: List[Dependency]

class UploadResponse(BaseModel):
    executionId: str
    status: str
    deprecated: List[DeprecatedDep]

class RepoInput(BaseModel):
    url: str
    branch: str = "main"

class PackageAnalysisRequest(BaseModel):
    repo_url: str
    package_name: str

# ---------------------------
# Utility Functions
# ---------------------------

def get_latest_version(pkg_name: str) -> str:
    url = f"https://registry.npmjs.org/{pkg_name}/latest"
    resp = requests.get(url)
    resp.raise_for_status()
    return resp.json()["version"]

def get_priority(current: str, latest: str, deprecated_msg: Optional[str] = None) -> str:
    if deprecated_msg:
        return "Must have"
    try:
        cur = [int(x) for x in current.lstrip("^~").split(".")]
        lat = [int(x) for x in latest.lstrip("^~").split(".")]
        while len(cur) < 3:
            cur.append(0)
        while len(lat) < 3:
            lat.append(0)
        if cur[0] < lat[0]:
            return "Must have"
        elif cur[1] < lat[1]:
            return "Should have"
        elif cur[2] < lat[2]:
            return "Could have"
        else:
            return "Won't have"
    except Exception:
        return "Won't have"

def find_package_json(directory: str) -> Optional[str]:
    for root, _, files in os.walk(directory):
        if 'package.json' in files:
            return os.path.join(root, 'package.json')
    return None

def determine_severity(deprecation_message: str) -> str:
    message = deprecation_message.lower()
    if any(word in message for word in ['security', 'vulnerability', 'critical', 'exploit', 'cve', 'rce']):
        return 'high'
    if any(word in message for word in ['broken', 'major', 'incompatible', 'breaking', 'removed', 'no longer maintained']):
        return 'medium'
    return 'low'

async def run_in_thread(*args, **kwargs):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: subprocess.run(*args, **kwargs))

# ---------------------------
# Endpoints
# ---------------------------

@app.post("/upload", response_model=UploadResponse)
async def upload(payload: UploadPayload):
    exec_id = payload.executionId
    log_path = f"{LOG_DIR}/exec-{exec_id}.json"

    initial = {
        "step": "Received payload",
        "executionId": exec_id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "dependenciesCount": len(payload.dependencies)
    }
    with open(log_path, "w") as f:
        json.dump([initial], f, indent=2)

    with open(log_path, "r") as f:
        logs = json.load(f)

    deprecated = []

    for dep in payload.dependencies:
        try:
            latest = get_latest_version(dep.name)
            priority = get_priority(dep.version, latest)
            entry = {
                "step": "Checked npm version",
                "name": dep.name,
                "current": dep.version,
                "latest": latest,
                "priority": priority,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            if priority != "Won't have":
                deprecated.append({
                    "name": dep.name,
                    "current": dep.version,
                    "latest": latest,
                    "priority": priority
                })
        except Exception as e:
            entry = {
                "step": "Error checking npm",
                "name": dep.name,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
        logs.append(entry)

    with open(log_path, "w") as f:
        json.dump(logs, f, indent=2)

    return UploadResponse(executionId=exec_id, status="checked", deprecated=deprecated)

@app.post("/analyze-repo/")
async def analyze_repository(repo: RepoInput):
    try:
        repo_url = repo.url
        if not repo_url.startswith(('http://', 'https://')):
            repo_url = f"https://github.com/{repo_url}"

        match = re.match(r'.*github\.com[/:]([^/]+)/([^/]+)', repo_url)
        if not match:
            raise HTTPException(status_code=400, detail="Invalid GitHub repository URL")

        owner, repo_name = match.groups()
        repo_name = repo_name.replace('.git', '')

        temp_dir = tempfile.mkdtemp()
        repo_path = os.path.join(temp_dir, repo_name)

        clone_cmd = ['git', 'clone', '--depth', '1', '--branch', repo.branch, repo_url, repo_path]
        result = subprocess.run(clone_cmd, capture_output=True, text=True)

        if result.returncode != 0:
            raise HTTPException(status_code=400, detail=f"Failed to clone repository: {result.stderr}")

        package_json_path = find_package_json(repo_path)
        if not package_json_path:
            raise HTTPException(status_code=404, detail="package.json not found")

        with open(package_json_path) as f:
            package_data = json.load(f)

        # Dummy websocket passed since this call doesn’t come from websocket
        class DummySocket:
            async def send_json(self, data): pass
        deprecated = await check_deprecated_packages(package_data, DummySocket())

        return {
            "repo_name": repo_name,
            "package_json": package_data,
            "deprecated_packages": deprecated,
            "temp_path": temp_dir
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/check-single-package/")
async def check_single_package(request: PackageAnalysisRequest):
    try:
        res = requests.get(f"https://registry.npmjs.org/{request.package_name}")
        if res.status_code != 200:
            return {"package": request.package_name, "deprecated": False}

        data = res.json()
        return {
            "package": request.package_name,
            "deprecated": "deprecated" in data.get('dist-tags', {}),
            "latest_version": data.get('dist-tags', {}).get('latest')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------
# WebSocket Endpoint
# ---------------------------

@app.websocket("/ws/analyze-repo")
async def analyze_repo_ws(websocket: WebSocket):
    await websocket.accept()

    # Define a variable to hold the start time of the current phase
    phase_start_time = time.time()

    try:
        # --- Establishing phase ---
        await websocket.send_json({"type": "log", "phase": "Establishing", "message": "Connection established."})

        data = await websocket.receive_json()
        repo_url = data.get("url")
        branch = data.get("branch", "main")

        if not repo_url:
            await websocket.send_json({"type": "error", "message": "Repository URL not provided."})
            return

        if not repo_url.startswith(('http://', 'https://', 'git@')):
            if '/' in repo_url:
                repo_url = f"https://github.com/{repo_url}"
            else:
                await websocket.send_json({"type": "error", "message": "Invalid repository format. Use 'owner/repo' or full URL"})
                return

        repo_match = re.match(r'(?:https?://github\.com/|git@github\.com:)([^/]+)/([^/]+?)(?:\.git)?$', repo_url)
        if not repo_match:
            await websocket.send_json({"type": "error", "message": "Invalid GitHub repository URL format"})
            return

        owner, repo_name = repo_match.groups()
        await websocket.send_json({"type": "repo_info", "data": {"name": f"{owner}/{repo_name}", "branch": branch}})

        base_clone_dir = os.path.abspath("./cloned_repos")
        os.makedirs(base_clone_dir, exist_ok=True)
        repo_path = os.path.join(base_clone_dir, repo_name)

        if os.path.exists(repo_path):
            shutil.rmtree(repo_path)

        await websocket.send_json({"type": "repo_info", "data": {"name": f"{owner}/{repo_name}", "branch": branch}})
        
        # --- End of Establishing phase, send duration ---
        duration = time.time() - phase_start_time
        await websocket.send_json({"type": "phase_complete", "phase": "Establishing", "duration": duration})
        phase_start_time = time.time() # Reset timer for the next phase

        # --- Cloning phase ---
        owner, repo_name = repo_match.groups()
        await websocket.send_json({"type": "repo_info", "data": {"name": f"{owner}/{repo_name}", "branch": branch}})
        await websocket.send_json({"type": "log", "phase": "Cloning", "message": f"Cloning repository..."})
        
        # ... (logic to create repo_path and clone) ...
        clone_cmd = ['git', 'clone', '--depth', '1', '--branch', branch, repo_url, repo_path]
        result = await run_in_thread(clone_cmd, capture_output=True, text=True)

        if result.returncode != 0:
            await websocket.send_json({"type": "error", "message": f"Failed to clone repository: {result.stderr}"})
            return

        await websocket.send_json({"type": "log", "message": "Repository cloned successfully."})
        # await websocket.send_json({"type": "log", "message": "Searching for package.json..."})
        # --- End of Cloning phase, send duration ---
        duration = time.time() - phase_start_time
        await websocket.send_json({"type": "phase_complete", "phase": "Cloning", "duration": duration})
        phase_start_time = time.time() # Reset timer for the next phase

        # --- Analyzing phase ---
        await websocket.send_json({"type": "log", "phase": "Analyzing", "message": "Searching for package.json..."})

        package_json_path = find_package_json(repo_path)
        if not package_json_path:
            await websocket.send_json({"type": "error", "message": "package.json not found in the repository."})
            return

        await websocket.send_json({"type": "log", "message": f"Found package.json at: {os.path.relpath(package_json_path, repo_path)}"})

        await websocket.send_json({"type": "log", "phase": "Analyzing", "message": "Analyzing packages for deprecations..."})

        with open(package_json_path) as f:
            package_data = json.load(f)

        await websocket.send_json({"type": "package_json", "data": package_data})
        await check_deprecated_packages(package_data, websocket)
         # --- End of Analyzing phase, send duration ---
        duration = time.time() - phase_start_time
        await websocket.send_json({"type": "phase_complete", "phase": "Analyzing", "duration": duration})
        await websocket.send_json({"type": "status", "message": "complete", "details": "Analysis complete."})

    except json.JSONDecodeError:
        await websocket.send_json({"type": "error", "message": "Invalid JSON received from client"})
    except asyncio.TimeoutError:
        await websocket.send_json({"type": "error", "message": "Operation timed out"})
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error trace:\n{error_trace}")
        await websocket.send_json({
            "type": "error",
            "message": f"Analysis failed: {str(e)}",
            "details": error_trace
        })
    finally:
        await websocket.close()

# ---------------------------
# Shared WebSocket Logic
# ---------------------------

async def check_deprecated_packages(package_data: Dict, websocket: WebSocket) -> List[Dict]:
    deprecated_list = []
    dependencies = {
        **package_data.get('dependencies', {}),
        **package_data.get('devDependencies', {}),
    }

    total_deps = len(dependencies)
    await websocket.send_json({"type": "log", "phase": "Analyzing", "message": f"Found {total_deps} dependencies to analyze."})

    for i, (pkg, version_spec) in enumerate(dependencies.items()):
        try:
            progress = int(((i + 1) / total_deps) * 100)
            await websocket.send_json({"type": "log", "phase": "Analyzing", "message": f"({i+1}/{total_deps}) Checking '{pkg}'..."})
            await websocket.send_json({"type": "progress", "phase": "Analyzing", "value": progress})
            
            res = requests.get(f"https://registry.npmjs.org/{pkg}", timeout=5)
            if res.status_code == 200:
                pkg_info = res.json()
                version_data = pkg_info.get('versions', {}).get(version_spec.strip('^~'))

                if version_data and version_data.get('deprecated'):
                    deprecation_reason = version_data['deprecated']
                    severity = determine_severity(deprecation_reason)
                    latest_version = pkg_info.get('dist-tags', {}).get('latest')

                    deprecated_pkg_info = {
                        "package": pkg,
                        "current_version": version_spec,
                        "latest_version": latest_version,
                        "reason": deprecation_reason,
                        "severity": severity
                    }
                    deprecated_list.append(deprecated_pkg_info)
                    await websocket.send_json({"type": "deprecated_package", "data": deprecated_pkg_info})

            await asyncio.sleep(0.05)

        except requests.RequestException as e:
            await websocket.send_json({"type": "error", "message": f"Could not check package {pkg}: {e}"})
            continue

    return deprecated_list
