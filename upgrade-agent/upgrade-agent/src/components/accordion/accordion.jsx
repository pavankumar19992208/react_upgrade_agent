import React, { useState } from 'react';
import './accordion.css';

export default function Accordion({ title, children, duration, status }) {
    const [open, setOpen] = useState(true);

    // Simple loader and tick icons (replace with your own if needed)
    const Loader = () => (
        <span className="accordion-loader" style={{ marginLeft: 8 }}>
            <span className="spinner" />
        </span>
    );
    const Tick = () => (
        <span className="accordion-tick" style={{ marginLeft: 8, color: '#6bcf7f' }}>
            ✔️
        </span>
    );

    return (
        <div className="accordion-section">
            <div className="accordion-title" onClick={() => setOpen(o => !o)}>
                <span>
                    {open ? '▼' : '▶'} {title}
                    {status === 'running' && <Loader />}
                    {status === 'done' && <Tick />}
                </span>
                {duration !== undefined && (
                    <span className="accordion-duration">
                        {duration.toFixed(2)}s
                    </span>
                )}
            </div>
            {open && <div className="accordion-content">{children}</div>}
        </div>
    );
}