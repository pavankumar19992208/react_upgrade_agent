// components/ProgressLoader.js
import React from 'react';
import './ProgressBar.css';

export default function ProgressLoader({ progress = 0 }) {
    return (
        <div className="progress-loader-container">
            <div className="progress-loader">
                <div 
                    className="progress-bar" 
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            <div className="progress-text">
                Analyzing repository... {progress}%
            </div>
        </div>
    );
}