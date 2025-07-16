import React, { useState } from "react";
import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";

function App() {
  const [status, setStatus] = useState("");

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file?.name.endsWith(".zip"))
      return setStatus("Please upload a .zip file");

    setStatus("Unzipping...");
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

    const executionId = `exec-${uuidv4()}`;
    setStatus("Sending to backend...");

    const res = await fetch("http://localhost:8000/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executionId, dependencies: deps }),
    });

    const json = await res.json();
    setStatus(`Backend replied: ${JSON.stringify(json)}`);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>🔧 Upgrade Agent</h1>
      <input type="file" accept=".zip" onChange={onFileChange} />
      <p>{status}</p>
    </div>
  );
}

export default App;
