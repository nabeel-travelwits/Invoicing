import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ConfigModal = ({ agency, onClose, onUpdate }) => {
    // Local state for form fields
    const [segmentEnabled, setSegmentEnabled] = useState(agency.segmentEnabled !== false);
    const [minMonthlyAmount, setMinMonthlyAmount] = useState(agency.minMonthlyAmount || 0);
    const [minUsers, setMinUsers] = useState(agency.minUsers || 0);

    // Ranges state: [{ min, max, price }]
    const [ranges, setRanges] = useState(agency.pricingRanges || []);

    const handleSave = () => {
        const config = {
            segmentEnabled,
            minMonthlyAmount: parseFloat(minMonthlyAmount),
            minUsers: parseFloat(minUsers),
            pricingRanges: ranges.map(r => ({
                min: parseInt(r.min),
                max: parseInt(r.max),
                price: parseFloat(r.price)
            }))
        };
        onUpdate(agency.id, config);
        onClose();
    };

    const addRange = () => {
        setRanges([...ranges, { min: 0, max: 0, price: 0 }]);
    };

    const removeRange = (index) => {
        setRanges(ranges.filter((_, i) => i !== index));
    };

    const updateRange = (index, field, value) => {
        const newRanges = [...ranges];
        newRanges[index][field] = value;
        setRanges(newRanges);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="modal-overlay"
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="glass-card"
                    style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', border: '1px solid var(--border)' }}
                    onClick={e => e.stopPropagation()}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{agency.name}</h2>
                            <span className="badge" style={{ background: 'var(--primary)', opacity: 0.8 }}>Configuration</span>
                        </div>
                        <button className="btn btn-ghost" onClick={onClose}><X size={24} /></button>
                    </div>

                    {/* Section 1: General Settings */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                            General Settings
                        </h3>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                            <div>
                                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>Segment Charges</h4>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Include segment fees in invoices</p>
                            </div>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={segmentEnabled}
                                    onChange={e => setSegmentEnabled(e.target.checked)}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>
                    </div>

                    {/* Section 2: Minimum Thresholds (Simple Only) */}
                    {agency.agreementType !== 'Complex' && (
                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                Minimum Thresholds
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                If active users are below the <strong>Min Users</strong> threshold, the <strong>Min Monthly Amount</strong> will strictly apply.
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Min Monthly Amount ($)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={minMonthlyAmount}
                                        onChange={e => setMinMonthlyAmount(e.target.value)}
                                        placeholder="0.00"
                                        style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Min Users Count</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={minUsers}
                                        onChange={e => setMinUsers(e.target.value)}
                                        placeholder="0"
                                        style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section 3: Complex Range Pricing */}
                    {agency.agreementType === 'Complex' && (
                        <div style={{ marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                <h3 style={{ fontSize: '1.1rem', color: 'var(--warning)' }}>
                                    Fixed Pricing Ranges
                                </h3>
                                <button className="btn btn-ghost" onClick={addRange} style={{ fontSize: '0.8rem', gap: '0.25rem' }}>
                                    <Plus size={14} /> Add Row
                                </button>
                            </div>

                            {ranges.length === 0 ? (
                                <div style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    No pricing ranges defined.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '0.5rem' }}>
                                        <span>Min Users</span>
                                        <span>Max Users</span>
                                        <span>Fixed Price ($)</span>
                                        <span></span>
                                    </div>
                                    {ranges.map((r, i) => (
                                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', gap: '0.5rem', alignItems: 'center' }}>
                                            <input
                                                type="number"
                                                value={r.min}
                                                onChange={e => updateRange(i, 'min', e.target.value)}
                                                className="input"
                                                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '4px', color: 'white' }}
                                            />
                                            <input
                                                type="number"
                                                value={r.max}
                                                onChange={e => updateRange(i, 'max', e.target.value)}
                                                className="input"
                                                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '4px', color: 'white' }}
                                            />
                                            <input
                                                type="number"
                                                value={r.price}
                                                onChange={e => updateRange(i, 'price', e.target.value)}
                                                className="input"
                                                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '4px', color: 'white' }}
                                            />
                                            <button
                                                className="btn btn-ghost"
                                                onClick={() => removeRange(i)}
                                                style={{ color: 'var(--danger)', padding: '0.5rem' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave}>
                            <Save size={18} /> Save Changes
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ConfigModal;
