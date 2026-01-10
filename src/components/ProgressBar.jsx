import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

/**
 * A beautiful, animated progress overlay with percentage display.
 * It can operate in 'controlled' mode (via progress prop) or 'simulated' mode (starts auto-filling).
 */
export const ProgressBar = ({ visible, progress, text, subtext }) => {
    const [displayProgress, setDisplayProgress] = useState(0);
    const [internalVisible, setInternalVisible] = useState(false);

    useEffect(() => {
        if (visible) {
            setInternalVisible(true);
            // Reset if starting new
            if (displayProgress >= 98) setDisplayProgress(0);

            // Handle controlled progress
            if (progress !== undefined) {
                setDisplayProgress(progress);
                return;
            }

            // Handle simulated progress (auto-increment)
            const interval = setInterval(() => {
                setDisplayProgress(prev => {
                    if (prev >= 98) return prev; // Don't hit 100 until finished
                    const jump = Math.random() * 5;
                    return Math.min(prev + jump, 98);
                });
            }, 300);

            return () => clearInterval(interval);
        } else {
            // Smooth transition to 100 when finished
            if (displayProgress > 0) {
                setDisplayProgress(100);
                const timer = setTimeout(() => {
                    setInternalVisible(false);
                    setDisplayProgress(0);
                }, 800);
                return () => clearTimeout(timer);
            } else {
                setInternalVisible(false);
            }
        }
    }, [visible, progress]);

    if (!internalVisible) return null;

    return (
        <AnimatePresence>
            {internalVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
                >
                    <div className="progress-container">
                        <motion.div
                            className="progress-bar"
                            animate={{ width: `${displayProgress}%` }}
                            transition={{ duration: displayProgress === 100 ? 0.4 : 0.2 }}
                        />
                    </div>
                    <div className="progress-overlay">
                        <div className="progress-percentage">{Math.round(displayProgress)}%</div>
                        <div className="progress-text">{displayProgress === 100 ? 'Process Complete!' : (text || 'Processing Datasets...')}</div>
                        {subtext && displayProgress < 100 && <div className="progress-subtext">{subtext}</div>}

                        <div style={{
                            marginTop: '2rem',
                            width: '48px',
                            height: '48px',
                            border: '3px solid var(--glass-border)',
                            borderTopColor: displayProgress === 100 ? 'var(--success)' : 'var(--primary)',
                            borderRadius: '50%',
                            animation: displayProgress === 100 ? 'none' : 'spin 1s linear infinite',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: displayProgress === 100 ? 'rgba(16, 185, 129, 0.1)' : 'transparent'
                        }}>
                            {displayProgress === 100 && <CheckCircle color="var(--success)" size={28} />}
                        </div>

                        <style>{`
                            @keyframes spin {
                                to { transform: rotate(360deg); }
                            }
                        `}</style>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
