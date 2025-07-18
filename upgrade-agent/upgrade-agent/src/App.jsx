import React, { useState } from "react";
import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";

function App() {
  const [status, setStatus] = useState("");
  const [results, setResults] = useState([]);

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file?.name.endsWith(".zip"))
      return setStatus("Please upload a .zip file");

    setStatus("Unzipping...");
    setResults([]);
    const zip = await JSZip.loadAsync(file);

    // Find package.json anywhere in the zip
    let pkg = null;
    zip.forEach((relativePath, zipEntry) => {
      if (relativePath.endsWith("package.json") && !pkg) {
        pkg = zipEntry;
      }
    });

    if (!pkg) return setStatus("No package.json in zip");

    const pkgJson = JSON.parse(await pkg.async("string"));
    const deps = Object.entries(pkgJson.dependencies || {}).map(
      ([name, version]) => ({ name, version })
    );

    setStatus("Sending each dependency to backend...");

    const executionId = `exec-${uuidv4()}`;
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i];
      setStatus(
        `Checking ${dep.name}@${dep.version} (${i + 1}/${deps.length})...`
      );
      try {
        const res = await fetch("http://localhost:8000/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ executionId, dependencies: [dep] }),
        });
        const json = await res.json();
        setResults((prev) => [...prev, json]);
      } catch (err) {
        setResults((prev) => [
          ...prev,
          { error: err.message, dependency: dep },
        ]);
      }
    }
    setStatus("All dependencies checked.");
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>🔧 Upgrade Agent</h1>
      <input type="file" accept=".zip" onChange={onFileChange} />
      <p>{status}</p>
      <ul>
        {results.map((res, idx) => (
          <li key={idx}>
            {res.error
              ? `Error: ${res.error} (${res.dependency.name})`
              : JSON.stringify(res)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
