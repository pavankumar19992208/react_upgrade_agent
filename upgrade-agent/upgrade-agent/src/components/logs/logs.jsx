import './logs.css';
import React, { useState, useEffect, useRef } from 'react';
import githubImg from '../../assets/github.png';
import Accordion from '../accordion/accordion.jsx'; // Import the Accordion component

export default function Logspage() {
    const [repoData, setRepoData] = useState(null);
    const [repoUrl, setRepoUrl] = useState('');
    const [logs, setLogs] = useState([]);
    const [status, setStatus] = useState('Pending'); // FIX: Added missing status state
    const ws = useRef(null);
    const [phaseLogs, setPhaseLogs] = useState({}); // { phase: [log, ...] }
    const [phaseDurations, setPhaseDurations] = useState({});
    const [phaseStatus, setPhaseStatus] = useState({});

    // Effect to clean up WebSocket on component unmount
    useEffect(() => {
        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, []);

    const handleAddRepo = () => {
        if (!repoUrl) {
            alert("Please enter a repository URL.");
            return;
        }

        // Reset previous state
        setLogs([]);
        setRepoData(null);
        setStatus('Analyzing');
        setPhaseLogs({});
        setPhaseDurations({});

        // Use 'ws://' for local development
        ws.current = new WebSocket("ws://localhost:8000/ws/analyze-repo");

        ws.current.onopen = () => {
            setLogs(prev => [...prev, "Connection established. Sending repo URL..."]);
            ws.current.send(JSON.stringify({ url: repoUrl }));
        };

        ws.current.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type === 'log' || message.type === 'error') {
                const phase = message.phase || 'General';
                setPhaseLogs(prev => ({
                    ...prev,
                    [phase]: [...(prev[phase] || []), message.message]
                }));
            }

            switch (message.type) {
                case 'log':
                    setLogs(prev => [...prev, message.message]);
                    // Mark phase as running
            if (message.phase) {
                setPhaseStatus(prev => ({
                    ...prev,
                    [message.phase]: 'running'
                }));
            }
                    break;
                case 'error':
                    setLogs(prev => [...prev, `[ERROR] ${message.message}`]);
                    setStatus('Error');
                    break;
                case 'repo_info':
                    setRepoData(prev => ({ ...prev, ...message.data }));
                    break;
                case 'package_json':
                    setRepoData(prev => ({ ...prev, packageJson: message.data }));
                    break;
                case 'deprecated_package':
                    setRepoData(prev => ({
                        ...prev,
                        deprecated: [...(prev?.deprecated || []), message.data]
                    }));
                    break;
                case 'phase_complete': // <-- ADD THIS CASE
                    setPhaseDurations(prev => ({
                        ...prev,
                        [message.phase]: message.duration
                    }));
                                setPhaseStatus(prev => ({
                ...prev,
                [message.phase]: 'done'
            }));
                    break;
                case 'status':
                    if (message.message === 'complete') {
                        setStatus('Analyzed');
                        setLogs(prev => [...prev, `[SUCCESS] ${message.details}`]);
                    }
                    break;
                default:
                    setLogs(prev => [...prev, `Unknown message type: ${message.type}`]);
            }
        };

        ws.current.onclose = () => {
            setLogs(prev => [...prev, "Connection closed."]);
            if (status === 'Analyzing') {
                setStatus('Error'); // If it closes during analysis, it's an error
            }
        };

        ws.current.onerror = (error) => {
            console.error("WebSocket error:", error);
            setLogs(prev => [...prev,
            `[ERROR] Connection error: ${error.message || 'Unknown error'}. ` +
            `Ensure the backend server is running at ws://localhost:8000`
            ]);
            setStatus('Error');
        };
        // Add connection timeout
        const connectionTimeout = setTimeout(() => {
            if (ws.current && ws.current.readyState !== WebSocket.OPEN) {
                setLogs(prev => [...prev, "[ERROR] Connection timeout. Server may not be running"]);
                setStatus('Error');
                ws.current?.close();
            }
        }, 5000);
        // Clear timeout when connection opens
        ws.current.onopen = () => {
            clearTimeout(connectionTimeout);
            setLogs(prev => [...prev, "Connection established. Sending repo URL..."]);
            ws.current.send(JSON.stringify({ url: repoUrl }));
        };
    };

    const renderAccordionLogs = () => {
        const phases = Object.keys(phaseLogs);
        if (phases.length === 0) return null;
return (
    <div className="logs-accordion">
        {phases.map(phase => (
            <Accordion
                key={phase}
                title={phase}
                duration={phaseDurations[phase]}
                status={phaseStatus[phase] || 'pending'}
            >
                {phaseLogs[phase].map((log, idx) => (
                    <div key={idx} className="log-line">
                        <span className="log-prefix">{'- '}</span>
                        <span className="log-message">{log}</span>
                    </div>
                ))}
            </Accordion>
        ))}
    </div>
);
    };

    // Helper function to render log output
    const renderLogOutput = () => {
        if (logs.length === 0 && status === 'Pending') {
            return <div style={{ color: '#888', padding: '40px', textAlign: 'center' }}>Enter a repository URL to begin analysis.</div>;
        }
        return (
            <div className="logs-output-container">
                {logs.map((log, index) => (
                    <div key={index} className="log-line">
                        <span className="log-prefix">{'> '}</span>
                        <span className="log-message">{log}</span>
                    </div>
                ))}
            </div>
        );
    };

    // Function to filter packages by severity
    const getPackagesBySeverity = (severity) => {
        if (!repoData || !repoData.deprecated) return [];
        return repoData.deprecated.filter(pkg => pkg.severity === severity);
    };

    // Function to render package list for each severity
    const renderPackageList = (packages, severity) => {
        if (!packages || packages.length === 0) {
            return (
                <div style={{ color: '#888', padding: '10px', fontSize: '12px' }}>
                    No {severity} severity packages found
                </div>
            );
        }

        return (
            <div className="package-checkbox-list">
                {packages.map((pkg, index) => (
                    <label key={index} style={{ display: 'block', margin: '8px 0', fontSize: '12px' }}>
                        <input type="checkbox" value={pkg.package || pkg.name} />
                        <span style={{ marginLeft: '8px' }}>
                            {pkg.package || pkg.name} (v{pkg.current_version || pkg.version} → v{pkg.latest_version || pkg.latestVersion})
                        </span>
                        {pkg.reason && (
                            <div style={{
                                fontSize: '10px',
                                color: '#999',
                                marginLeft: '20px',
                                marginTop: '2px',
                                fontStyle: 'italic'
                            }}>
                                {pkg.reason}
                            </div>
                        )}
                    </label>
                ))}
            </div>
        );
    };

    const highSeverityPackages = getPackagesBySeverity('high');
    const mediumSeverityPackages = getPackagesBySeverity('medium');
    const lowSeverityPackages = getPackagesBySeverity('low');

    return (
        <div className='logs-page'>
            <div className="logs-header">
                <p>Package Upgrader</p>
            </div>
            <div className='logs-grid'>
                {/* Left Panel */}
                <div className='logs-grid-item'>
                    <div className='add-repo-container'>
                        <div className='add-repo-title'>Add GitHub Repo</div>
                        <div className='add-repo-row'>
                            <input
                                className='add-repo-input'
                                type='text'
                                value={repoUrl}
                                onChange={(e) => setRepoUrl(e.target.value)}
                                placeholder='e.g., facebook/react'
                                disabled={status === 'Analyzing'}
                            />
                            <button className='add-repo-button' onClick={handleAddRepo} disabled={status === 'Analyzing'}>
                                {status === 'Analyzing' ? 'Analyzing...' : 'Add'}
                            </button>
                        </div>
                    </div>
                    {repoData && repoData.name && (
                        <button className='repo-button' style={{ background: '#007acc' }}>
                            <img src={githubImg} alt="github" style={{ marginRight: '12px', verticalAlign: 'middle', width: '1.5rem', height: '1.5rem' }} />
                            <span>{repoData.name}</span>
                        </button>
                    )}
                </div>

                {/* Middle Panel - Real-time Logs */}
                <div className='logs-grid-item-2'>
                    <div className='logs-title-container'>
                        <div className="logs-title-left">
                            <span className="logs-title">{repoData?.name || 'Repository'}</span>
                            <span className="logs-branch">{repoData?.branch || 'main'}</span>
                        </div>
                        <div className="logs-title-right">
                            <div className="logs-status-group">
                                <span className="logs-status">Status</span>
                                <span className="logs-status-value" style={{ color: status === 'Analyzed' ? '#6bcf7f' : (status === 'Error' ? '#ff6b6b' : '#ffd93d') }}>
                                    {status}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className='logs-container'>
                        <div style={{ color: 'white', fontWeight: 600, padding: '10px' }}>
                            Live Analysis Logs
                        </div>
                        {/* {renderLogOutput()} */}
                        {renderAccordionLogs()}
                    </div>
                </div>

                {/* Right Panel - Deprecated Packages */}
                <div className='logs-grid-item-3'>
                    <div className="upgraded-title">
                        Deprecated Packages
                        {repoData && repoData.deprecated && (
                            <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>
                                ({repoData.deprecated.length} total found)
                            </span>
                        )}
                    </div>
                    <div className="upgraded-boxes">
                        <div className="upgraded-box-1">
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                <span>High Severity</span>
                                <span style={{ fontSize: '12px', color: '#ff6b6b', marginLeft: '8px', background: 'rgba(255, 107, 107, 0.1)', padding: '2px 6px', borderRadius: '3px' }}>
                                    {highSeverityPackages.length}
                                </span>
                            </div>
                            {renderPackageList(highSeverityPackages, 'high')}
                        </div>
                        <div className="upgraded-box-2">
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                <span>Medium Severity</span>
                                <span style={{ fontSize: '12px', color: '#ffa500', marginLeft: '8px', background: 'rgba(255, 165, 0, 0.1)', padding: '2px 6px', borderRadius: '3px' }}>
                                    {mediumSeverityPackages.length}
                                </span>
                            </div>
                            {renderPackageList(mediumSeverityPackages, 'medium')}
                        </div>
                        <div className="upgraded-box-3">
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                <span>Low Severity</span>
                                <span style={{ fontSize: '12px', color: '#90EE90', marginLeft: '8px', background: 'rgba(144, 238, 144, 0.1)', padding: '2px 6px', borderRadius: '3px' }}>
                                    {lowSeverityPackages.length}
                                </span>
                            </div>
                            {renderPackageList(lowSeverityPackages, 'low')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}