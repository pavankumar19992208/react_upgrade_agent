from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Literal
from fastapi.middleware.cors import CORSMiddleware
import os, json
from datetime import datetime
import requests

LOG_DIR = "./logs"
os.makedirs(LOG_DIR, exist_ok=True)
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"])

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

def get_latest_version(pkg_name: str) -> str:
    url = f"https://registry.npmjs.org/{pkg_name}/latest"
    resp = requests.get(url)
    resp.raise_for_status()
    return resp.json()["version"]

def get_priority(current: str, latest: str) -> str:
    try:
        cur = [int(x) for x in current.lstrip("^~").split(".")]
        lat = [int(x) for x in latest.lstrip("^~").split(".")]
        while len(cur) < 3: cur.append(0)
        while len(lat) < 3: lat.append(0)
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

    # Check each dependency
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