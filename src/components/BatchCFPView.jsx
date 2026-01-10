import React, { useState, useEffect } from 'react';
import {
    Loader2,
    CheckCircle,
    AlertTriangle,
    Send,
    ArrowLeft,
    Package,
    FileCheck,
    XCircle,
    Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgressBar } from './ProgressBar';

const BatchCFPView = ({ agencies, onBack, user }) => {
    const [loading, setLoading] = useState(false);
    const [batchData, setBatchData] = useState([]);
    const [billingPeriod, setBillingPeriod] = useState(() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return date.toISOString().slice(0, 7);
    });

    const [processingStep, setProcessingStep] = useState('idle'); // idle, reconciling, ready, sending, done
    const [errors, setErrors] = useState([]);
    const [progress, setProgress] = useState(0);

    const runBatchReconciliation = async () => {
        setLoading(true);
        setProcessingStep('reconciling');
        setErrors([]);
        setProgress(0);

        // Start progress simulation since it's one big API call
        const interval = setInterval(() => {
            setProgress(prev => (prev >= 95 ? prev : prev + Math.floor(Math.random() * 5) + 2));
        }, 400);

        try {
            const res = await fetch(`/api/batch-reconcile-cfp?period=${billingPeriod}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agencyIds: agencies.map(a => a.id) })
            });
            const data = await res.json();

            clearInterval(interval);
            setProgress(100);

            // Enrich with default status
            const enriched = data.map(item => ({
                ...item,
                status: 'pending', // pending, generating, ready, sending, sent, error
                error: null,
                stripeInfo: null,
                excelInfo: null
            }));

            setTimeout(() => {
                setBatchData(enriched);
                setProcessingStep('ready');
            }, 500);
        } catch (err) {
            clearInterval(interval);
            setErrors([{ message: 'Failed to carry out batch reconciliation: ' + err.message }]);
        } finally {
            setLoading(false);
        }
    };

    const processBatch = async () => {
        setProcessingStep('sending');
        setErrors([]);
        setProgress(0);

        const total = batchData.length;
        const currentData = [...batchData];

        for (let i = 0; i < currentData.length; i++) {
            const item = currentData[i];
            try {
                // 1. Generate Excel
                item.status = 'generating';
                setBatchData([...currentData]);

                const excelRes = await fetch(`/api/generate-excel/${item.agency.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agency: item.agency,
                        reconciliation: item.reconciliation,
                        segmentUsage: item.segmentUsage,
                        billingPeriod
                    })
                });
                const excelData = await excelRes.json();
                item.excelInfo = excelData;

                // 2. Create Stripe Invoice
                const stripeRes = await fetch(`/api/create-invoice/${item.agency.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agency: item.agency,
                        reconciliation: item.reconciliation,
                        segmentUsage: item.segmentUsage
                    })
                });
                const stripeData = await stripeRes.json();
                item.stripeInfo = stripeData;

                // 3. Send Invoice
                item.status = 'sending';
                setBatchData([...currentData]);

                const sendRes = await fetch(`/api/send-invoice/${stripeData.stripeInvoiceId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agencyId: item.agency.id,
                        agencyName: item.agency.name,
                        amount: stripeData.total,
                        period: billingPeriod,
                        invoiceType: 'CFP',
                        loggedInUserEmail: user?.email
                    })
                });

                if (!sendRes.ok) throw new Error('Failed to send email');

                item.status = 'sent';
            } catch (err) {
                console.error(`Error processing ${item.agency.name}:`, err);
                item.status = 'error';
                item.error = err.message;
                setErrors(prev => [...prev, { agency: item.agency.name, error: err.message }]);
            }

            setProgress(Math.round(((i + 1) / total) * 100));
            setBatchData([...currentData]);
        }

        setProcessingStep('done');
    };

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <button className="btn btn-ghost" onClick={onBack} disabled={processingStep === 'sending'}>
                        <ArrowLeft size={18} /> Back
                    </button>
                    <h1 style={{ fontSize: '2.5rem', marginTop: '1rem' }}>CFP Batch Invoicing</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Process all {agencies.length} affiliate sites in one workflow.</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input
                        type="month"
                        value={billingPeriod}
                        onChange={(e) => setBillingPeriod(e.target.value)}
                        disabled={processingStep !== 'idle' && processingStep !== 'ready'}
                        style={{ padding: '0.6rem 1rem' }}
                    />
                    {processingStep === 'idle' && (
                        <button className="btn btn-primary" onClick={runBatchReconciliation} disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <><Package size={18} /> Prepare Batch</>}
                        </button>
                    )}
                    {processingStep === 'ready' && (
                        <button className="btn btn-primary" style={{ background: 'var(--success)' }} onClick={processBatch}>
                            <Send size={18} /> Execute & Send All
                        </button>
                    )}
                </div>
            </header>

            {processingStep === 'reconciling' && (
                <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', textAlign: 'center', background: 'rgba(99, 102, 241, 0.05)', border: '1px dashed var(--primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <Loader2 className="animate-spin" size={24} color="var(--primary)" />
                        <h3 style={{ margin: 0 }}>Reconciling CFP Data... {progress}%</h3>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden', maxWidth: '400px', margin: '1rem auto' }}>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            style={{ height: '100%', background: 'var(--primary)' }}
                        />
                    </div>
                    <p style={{ color: 'var(--text-muted)' }}>Analyzing bookings for {agencies.length} affiliate sites. Please wait...</p>
                </div>
            )}

            {processingStep === 'sending' && (
                <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', textAlign: 'center' }}>
                    <h3>Processing Batch... {progress}%</h3>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden' }}>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            style={{ height: '100%', background: 'var(--primary)' }}
                        />
                    </div>
                </div>
            )}

            {batchData.length > 0 && (
                <div className="glass-card" style={{ padding: '0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '1.25rem' }}>Affiliate Site</th>
                                <th style={{ padding: '1.25rem' }}>Bookings</th>
                                <th style={{ padding: '1.25rem' }}>Rate</th>
                                <th style={{ padding: '1.25rem' }}>Total Amount</th>
                                <th style={{ padding: '1.25rem' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {batchData.map((item, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)', opacity: item.status === 'sent' ? 0.6 : 1 }}>
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ fontWeight: 600 }}>{item.agency.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {item.agency.id}</div>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>{item.segmentUsage[0].count}</td>
                                    <td style={{ padding: '1.25rem' }}>${item.agency.segmentPrice.toFixed(2)}</td>
                                    <td style={{ padding: '1.25rem', fontWeight: 700 }}>
                                        ${(item.segmentUsage[0].count * item.agency.segmentPrice).toFixed(2)}
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <StatusBadge status={item.status} error={item.error} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: 'rgba(99, 102, 241, 0.1)', borderTop: '2px solid var(--primary)' }}>
                                <td colSpan={3} style={{ padding: '1.5rem', fontWeight: 700, fontSize: '1.1rem' }}>BATCH TOTAL</td>
                                <td style={{ padding: '1.5rem', fontWeight: 800, fontSize: '1.3rem', color: 'var(--success)' }}>
                                    ${batchData.reduce((sum, item) => sum + (item.segmentUsage[0].count * item.agency.segmentPrice), 0).toFixed(2)}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {errors.length > 0 && (
                <div className="glass-card" style={{ marginTop: '2rem', borderLeft: '4px solid var(--error)', padding: '1.5rem' }}>
                    <h3 style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <AlertTriangle size={20} /> Processing Errors ({errors.length})
                    </h3>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {errors.map((err, i) => (
                            <div key={i} style={{ padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                                <strong>{err.agency}:</strong> {err.error}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const StatusBadge = ({ status, error }) => {
    switch (status) {
        case 'pending': return <span className="badge">Pending</span>;
        case 'generating': return <span className="badge badge-warning"><Loader2 className="animate-spin" size={12} /> Working...</span>;
        case 'sending': return <span className="badge badge-primary"><Loader2 className="animate-spin" size={12} /> Emailing...</span>;
        case 'sent': return <span className="badge badge-success"><CheckCircle size={12} /> Sent</span>;
        case 'error': return <span className="badge badge-danger" title={error}><XCircle size={12} /> Failed</span>;
        default: return <span className="badge">{status}</span>;
    }
};

export default BatchCFPView;
