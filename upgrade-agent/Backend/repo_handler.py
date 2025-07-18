import os
import json
import shutil
import subprocess

def clone_repo(repo_url: str, base_dir="cloned_repos"):
    os.makedirs(base_dir, exist_ok=True)
    repo_name = repo_url.split("/")[-1].replace(".git", "")
    repo_path = os.path.join(base_dir, repo_name)
    if os.path.exists(repo_path):
        shutil.rmtree(repo_path)
    subprocess.run(["git", "clone", repo_url, repo_path])
    return repo_name, repo_path

def extract_package_json(repo_path):
    package_path = os.path.join(repo_path, "package.json")
    with open(package_path, "r") as f:
        return json.load(f)

def check_deprecated_packages(package_json):
    dependencies = package_json.get("dependencies", {})
    deprecated = []
    for pkg, version in dependencies.items():
        result = subprocess.run(["npm", "view", pkg, "deprecated"], capture_output=True, text=True)
        if result.stdout.strip():
            deprecated.append({
                "name": pkg,
                "version": version,
                "reason": result.stdout.strip()
            })
    return deprecated
