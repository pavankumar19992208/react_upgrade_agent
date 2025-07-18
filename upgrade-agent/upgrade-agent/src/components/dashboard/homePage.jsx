import './homePage.css';
import React, { useState } from 'react';
import githubImg from '../../assets/github.png';
import { FcFolder } from "react-icons/fc";
import uploadFolder from '../../assets/folder.png';
import ProgressLoader from '../progress-bar/progressBar.jsx'
import Divider from '@mui/material/Divider';
import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";
import { useNavigate } from "react-router-dom";

export default function Homepage() {
    const [uploadProgress, setUploadProgress] = useState(0);
    const [showProgress, setShowProgress] = useState(false);
    const [repoUrl, setRepoUrl] = useState("");
    const [repos, setRepos] = useState([]);
    const [selectedRepo, setSelectedRepo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedPackages, setSelectedPackages] = useState({});
    const [status, setStatus] = useState("");
    const fileInputRef = React.useRef(null);
    const navigate = useNavigate();
    const [logSteps, setLogSteps] = useState([]);

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

    const handleAddRepo = async () => {
        if (!repoUrl) return;
        setLoading(true);
        setUploadProgress(0);
        setShowProgress(true);
        setLogSteps([
            { label: 'Cloning repository...', status: 'pending' },
            { label: 'Parsing package.json...', status: 'pending' },
            { label: 'Checking deprecated packages...', status: 'pending' },
            { label: 'Analyzing severity levels...', status: 'pending' }
        ]);
        try {
            setLoading(true);
            // Create a progress interval
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) { // Stop at 90% until request completes
                        clearInterval(progressInterval);
                        return prev;
                    }
                    return prev + 10;
                });
            }, 300);
            // Call backend API to analyze repo
            const response = await fetch('http://localhost:8000/analyze-repo/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: repoUrl,
                    branch: 'main'
                })
            });

            clearInterval(progressInterval); // Clear when request completes
            setUploadProgress(100); // Complete the progress

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Add new repo to the list
            // const newRepo = {
            //     name: data.repo_name,
            //     packageJson: data.package_json,
            //     deprecated: data.deprecated_packages.map(dep => ({
            //         name: dep.package,
            //         version: dep.current_version,
            //         reason: dep.reason,
            //         latestVersion: dep.latest_version
            //     }))
            // };


            // REPLACE the setRepos and setSelectedRepo logic with navigation
            navigate('/logs', {
                state: {
                    repoData: {
                        name: data.repo_name,
                        packageJson: data.package_json,
                        deprecated: data.deprecated_packages.map(dep => ({
                            name: dep.package,
                            version: dep.current_version,
                            reason: dep.reason,
                            latestVersion: dep.latest_version
                        })),
                        url: repoUrl,
                        branch: 'main'
                    }
                }
            });


            // setRepos([...repos, newRepo]);
            // setRepoUrl("");

            // Select the newly added repo
            // setSelectedRepo(newRepo);
            // Wait a moment before hiding to show completion
            setTimeout(() => setShowProgress(false), 500);
        } catch (error) {
            console.error("Error adding repository:", error);
            alert(`Failed to add repository: ${error.message}`);
            setUploadProgress(0);
            setShowProgress(false);
        } finally {
            setLoading(false);

        }
    };

    const handleUpdateSelected = async () => {
        const packagesToUpdate = selectedRepo.deprecated
            .filter(pkg => selectedPackages[pkg.name])
            .map(pkg => ({
                name: pkg.name,
                currentVersion: pkg.version,
                latestVersion: pkg.latestVersion
            }));

        if (packagesToUpdate.length === 0) return;

        try {
            setLoading(true);
            // Call your backend API to update packages
            const response = await fetch('http://localhost:8000/update-packages/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    repo: selectedRepo.name,
                    packages: packagesToUpdate
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            // Handle successful update (refresh the repo data or show success message)
            alert('Packages updated successfully!');
            // You might want to refresh the repo data here
        } catch (error) {
            console.error("Error updating packages:", error);
            alert(`Failed to update packages: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleRepoSelect = (repoName) => {
        const repo = repos.find(r => r.name === repoName);
        setSelectedRepo(repo);
    };

    const handlePackageSelect = (pkgName, isChecked) => {
        setSelectedPackages(prev => ({
            ...prev,
            [pkgName]: isChecked
        }));
    };

    // Add this function to categorize packages
    const categorizePackages = (packages) => {
        return packages.reduce((acc, pkg) => {
            const severity = pkg.severity || 'low'; // Default to low if no severity
            if (!acc[severity]) {
                acc[severity] = [];
            }
            acc[severity].push(pkg);
            return acc;
        }, {});
    };

    return (
        <div>
            <div className="homepage-header">
                <p>Package Upgrader</p>
            </div>
            <div className='homepage-grid' style={{
                gridTemplateColumns: repos.length > 0 ? '20% 1fr 20%' : '1fr'
            }}>
                {/* {repos.length > 0 && (
                    <div className='homepage-grid-item' >
                        <button className='add-folder-button' accept=".zip" onChange={onFileChange}>
                            <span>Add Folder</span>
                            <FcFolder style={{ marginLeft: '12px', verticalAlign: 'middle', fontSize: '1.5rem', fontWeight: '800' }} />
                        </button>
                        <div className='add-repo-container'>
                            <div className='add-repo-title'>Add Repo</div>
                            <div className='add-repo-row'>
                                <input
                                    className='add-repo-input'
                                    type='text'
                                    placeholder='Enter repository URL'
                                    value={repoUrl}
                                    onChange={(e) => setRepoUrl(e.target.value)}
                                    disabled={loading}
                                />
                                <button
                                    className='add-repo-button'
                                    onClick={handleAddRepo}
                                    disabled={loading || !repoUrl}
                                >
                                    {loading ? 'Adding...' : 'Add'}
                                </button>
                            </div>
                        </div>
                        {repos.map((repo, index) => (
                            <button
                                key={index}
                                className={`repo-button ${selectedRepo?.name === repo.name ? 'active' : ''}`}
                                onClick={() => handleRepoSelect(repo.name)}
                            >
                                <img
                                    src={githubImg}
                                    alt="folder"
                                    style={{ marginRight: '12px', verticalAlign: 'middle', width: '1.5rem', height: '1.5rem', fontWeight: '800' }}
                                />
                                <span>{repo.name}</span>
                            </button>
                        ))}
                    </div>
                )} */}
                <div className='homepage-grid-item-2'>
                    {selectedRepo ? (
                        <div className="package-json-display">
                            <h3>package.json</h3>
                            <pre>{JSON.stringify(selectedRepo.packageJson, null, 2)}</pre>
                        </div>
                    ) : (
                        <div className="upload-prompt">
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '40px',
                                // padding: '50px',
                                marginBottom: '20px'
                            }}>
                                <img
                                    src={uploadFolder}
                                    alt="folder"
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        verticalAlign: 'middle',
                                        width: '4rem',
                                        height: '4rem',
                                        cursor: 'pointer'
                                    }}
                                />
                                <input
                                    type="file"
                                    accept=".zip"
                                    style={{ display: 'none' }}
                                    ref={fileInputRef}
                                    onChange={onFileChange}
                                />
                                <Divider />
                                <div className='add-repo-cont'>
                                    <div className='add-repo-title'>Add Repo</div>
                                    <div className='add-repo-row'>
                                        <input
                                            className='add-repo-input'
                                            type='text'
                                            placeholder='Enter repository URL'
                                            value={repoUrl}
                                            onChange={(e) => setRepoUrl(e.target.value)}
                                            disabled={loading}
                                        />
                                        <button
                                            className='add-repo-button'
                                            onClick={handleAddRepo}
                                            disabled={loading || !repoUrl}
                                        >
                                            {loading ? 'Adding...' : 'Add'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <p className='homepage-grid-item-text'>
                                {repos.length > 0 ? 'Select a repository' : 'Upload a folder or add a repo to get started'}
                            </p>
                            {loading && <ProgressLoader progress={uploadProgress} />}
                        </div>
                    )}
                </div>
                {/* Only show grid item 3 when we have a selected repo with package data */}
                {/* {selectedRepo && selectedRepo.packageJson && (
                    <div className='homepage-grid-item-3'>
                        {selectedRepo.deprecated?.length > 0 ? (
                            <div className="deprecated-packages">
                                <div className='title-1'>Deprecated Packages</div>
                               
                                {Object.entries(categorizePackages(selectedRepo.deprecated)).map(([severity, packages]) => (
                                    <div key={severity} className={`severity-section severity-${severity}`}>
                                        <h4 className={`severity-header`}>
                                            {severity.charAt(0).toUpperCase() + severity.slice(1)} Severity
                                        </h4>
                                        <ul className='deprecated-list'>
                                            {selectedRepo.deprecated.map((pkg, i) => (
                                                <li key={i}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPackages[pkg.name] || false}
                                                        onChange={(e) => handlePackageSelect(pkg.name, e.target.checked)}
                                                        className="package-checkbox"
                                                    />
                                                    <strong>{pkg.name}</strong> ({pkg.version}) — {pkg.reason}
                                                    {pkg.latestVersion && (
                                                        <span className="latest-version">Latest: {pkg.latestVersion}</span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                                <div className="update-button-container">
                                    <button
                                        className="update-button"
                                        onClick={() => handleUpdateSelected()}
                                        disabled={Object.values(selectedPackages).filter(Boolean).length === 0}
                                    >
                                        Update Selected
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p>No deprecated packages found</p>
                        )}
                    </div>
                )} */}
            </div>
        </div>
    );
}