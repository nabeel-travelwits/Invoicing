import React, { useState, useEffect } from 'react';
import {
    ArrowLeft,
    FileCheck,
    AlertTriangle,
    CheckCircle,
    Download,
    Send,
    Loader2,
    Table as TableIcon,
    ExternalLink,
    ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgressBar } from './ProgressBar';

const PipelineView = ({ agency: initialAgency, onBack, segmentOnly = false }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ visible: false, text: '' });
    // Default to previous month
    const [billingPeriod, setBillingPeriod] = useState(() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return date.toISOString().slice(0, 7);
    });
    const [step, setStep] = useState('reconcile'); // reconcile, excel, stripe
    const [excelInfo, setExcelInfo] = useState(null);
    const [stripeInfo, setStripeInfo] = useState(null);

    // Modal state for status check
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [statusToConfirm, setStatusToConfirm] = useState('');

    const fetchReconciliation = async () => {
        setLoading(true);
        setProgress({ visible: true, text: `Running Data Reconciliation for ${initialAgency.name}...` });
        try {
            const endpoint = segmentOnly
                ? `/api/reconcile-cfp/${initialAgency.id}?period=${billingPeriod}`
                : `/api/reconcile/${initialAgency.id}?period=${billingPeriod}`;

            const res = await fetch(endpoint);
            const result = await res.json();

            if (result.error) {
                alert(result.error);
                onBack();
                return;
            }

            // If segmentOnly mode is active, override charge to 0
            if (segmentOnly && result.reconciliation) {
                result.reconciliation.summary.totalCharge = 0;
                result.reconciliation.normal.forEach(u => u.charge = 0);
                result.reconciliation.new.forEach(u => u.charge = 0);
                result.reconciliation.deactivated.forEach(u => u.charge = 0);
                result.reconciliation.summary.totalCharge = 0;
            }

            setData(result);
            setStep('reconcile');
        } catch (err) {
            console.error(err);
            alert('Failed to run reconciliation');
        } finally {
            setLoading(false);
            setProgress({ visible: false, text: '' });
        }
    };

    useEffect(() => {
        fetchReconciliation();
    }, [billingPeriod]); // Re-fetch only when period changes (user interaction)

    const handleProceedToExcel = () => {
        const status = data?.agency?.status;

        if (!status) {
            alert('Error: Agency status is not defined. Please update status in Airtable first.');
            return;
        }

        if (status.toLowerCase() !== 'active') {
            setStatusToConfirm(status);
            setShowStatusModal(true);
            return;
        }

        generateExcel();
    };

    const generateExcel = async () => {
        setShowStatusModal(false);
        setLoading(true);
        setProgress({ visible: true, text: `Generating Excel Report for ${initialAgency.name}...` });
        try {
            const response = await fetch(`/api/generate-excel/${initialAgency.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agency: data.agency,
                    reconciliation: data.reconciliation,
                    segmentUsage: data.segmentUsage,
                    billingPeriod
                })
            });
            const result = await response.json();
            setExcelInfo(result);
            setStep('excel');
        } catch (err) {
            alert('Failed to generate Excel');
        } finally {
            setLoading(false);
            setProgress({ visible: false, text: '' });
        }
    };

    const createStripeInvoice = async () => {
        setLoading(true);
        setProgress({ visible: true, text: `Creating Stripe Invoice for ${initialAgency.name}...` });
        try {
            const response = await fetch(`/api/create-invoice/${initialAgency.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agency: data.agency,
                    reconciliation: data.reconciliation,
                    segmentUsage: data.segmentUsage
                })
            });
            const result = await response.json();
            setStripeInfo(result);
            setStep('stripe');
        } catch (err) {
            alert(err.message || 'Failed to create Stripe invoice');
        } finally {
            setLoading(false);
            setProgress({ visible: false, text: '' });
        }
    };



    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pipeline-container">
            <ProgressBar visible={progress.visible} text={progress.text} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <button className="btn btn-ghost" onClick={onBack}>
                    <ArrowLeft size={18} /> Back to Dashboard
                </button>
                <div className="glass-card" style={{ padding: '0.5rem 1.5rem', borderLeft: '4px solid var(--primary)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>CURRENT AGENCY:</span>
                    <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-main)' }}>{initialAgency?.name}</h2>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                <div className="glass-card" style={{ width: '300px', padding: '1.5rem', flexShrink: 0 }}>
                    <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Invoicing Steps</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <StepItem active={step === 'reconcile'} done={!!data} label="Data Reconciliation" />
                        <StepItem active={step === 'excel'} done={!!excelInfo} label="Excel Generation" />
                        <StepItem active={step === 'stripe'} done={!!stripeInfo} label="Stripe Invoice Creation" />
                        <StepItem active={step === 'done'} done={false} label="Final Confirmation" />
                    </div>
                </div>

                <div style={{ flexGrow: 1 }}>
                    {step === 'reconcile' && data && (
                        <div className="animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Step 1: Reconciliation</h2>
                                    <p style={{ color: 'var(--text-muted)' }}>{segmentOnly ? 'CFP Mode: Fetching segment usage only.' : 'Comparing Baserow lifecycle with Google Sheets roster.'}</p>
                                </div>
                                {data?.isGapFree ? (
                                    <div className="badge badge-success" style={{ height: 'fit-content', padding: '0.5rem 1rem' }}>
                                        <CheckCircle size={14} /> VALIDATION PASSED
                                    </div>
                                ) : (
                                    <div className="badge badge-danger" style={{ height: 'fit-content', padding: '0.5rem 1rem' }}>
                                        <AlertTriangle size={14} /> {data?.reconciliation?.summary?.totalMismatches || 0} MISMATCHES FOUND
                                    </div>
                                )}
                            </div>

                            <div className="grid" style={{ gridTemplateColumns: segmentOnly ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                                {!segmentOnly && (
                                    <>
                                        <StatCard label="Normal Active" value={data?.reconciliation?.summary?.totalActive || 0} />
                                        <StatCard label="New (Prorated)" value={data?.reconciliation?.summary?.totalNew || 0} color="var(--primary)" />
                                        <StatCard label="Deactivated (Prorated)" value={data?.reconciliation?.summary?.totalDeactivated || 0} color="var(--warning)" />
                                        <StatCard label="Test Users" value={data?.reconciliation?.summary?.totalTestUsers || 0} color="var(--success)" />
                                    </>
                                )}

                                <StatCard
                                    label={segmentOnly ? "CFP Bookings Found" : "Segments Found"}
                                    value={data?.segmentUsage?.reduce((sum, s) => sum + s.count, 0) || 0}
                                    color="var(--success)"
                                />
                                <StatCard
                                    label="Agency Status"
                                    value={data?.agency?.status || 'N/A'}
                                    color={data?.agency?.status?.toLowerCase() === 'active' ? 'var(--success)' : 'var(--warning)'}
                                />
                                {!segmentOnly && (
                                    <StatCard
                                        label="Per User Fee"
                                        value={data?.agency?.userPrice !== undefined ? `$${data?.agency?.userPrice?.toFixed(2)}` : 'Not Set'}
                                        color={data?.agency?.userPrice !== undefined ? "var(--primary)" : "var(--error)"}
                                    />
                                )}
                                <StatCard
                                    label={segmentOnly ? "Per Booking Fee" : "Per Segment Fee"}
                                    value={data?.agency?.segmentPrice !== undefined ? `$${data?.agency?.segmentPrice?.toFixed(2)}` : 'Not Set'}
                                    color={data?.agency?.segmentPrice !== undefined ? "var(--primary)" : "var(--error)"}
                                />
                            </div>

                            {/* Mismatch List Display */}
                            {data?.reconciliation?.mismatches?.length > 0 && (
                                <div style={{ marginBottom: '2rem' }}>
                                    <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--warning)' }}>
                                        <AlertTriangle size={20} style={{ marginRight: '0.5rem', display: 'inline' }} />
                                        Reconciliation Mismatches ({data.reconciliation.mismatches.length})
                                    </h3>
                                    <div className="glass-card" style={{ padding: '0' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>User / Email</th>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Issue</th>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Severity</th>
                                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Source</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.reconciliation.mismatches.map((m, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '1rem' }}>{m.email || m.userId}</td>
                                                        <td style={{ padding: '1rem' }}>{m.issue}</td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <span style={{
                                                                padding: '0.25rem 0.75rem',
                                                                borderRadius: '99px',
                                                                background: m.severity === 'Blocker' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                                                                color: m.severity === 'Blocker' ? 'var(--error)' : 'var(--warning)',
                                                                fontSize: '0.8rem'
                                                            }}>
                                                                {m.severity}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>Baserow/Sheets</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                            Please resolve these issues in the source systems (Baserow/Auth Users in Google Sheet) and click "Sync & Re-Validate".
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="btn btn-ghost" onClick={fetchReconciliation} disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Sync & Re-Validate'}
                                </button>
                                {data?.isGapFree && (
                                    <button className="btn btn-primary" onClick={handleProceedToExcel} disabled={loading}>
                                        Confirm & Proceed to Excel file Creation <ArrowLeft style={{ transform: 'rotate(180deg)' }} size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'excel' && excelInfo && (
                        <div className="animate-fade-in">
                            <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Step 2: Excel Report Ready</h2>
                            <div className="glass-card" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem' }}>
                                <div style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '1rem', color: 'var(--success)' }}>
                                    <TableIcon size={48} />
                                </div>
                                <div style={{ flexGrow: 1 }}>
                                    <h3>{excelInfo.fileName}</h3>
                                    <p style={{ color: 'var(--text-muted)' }}>
                                        {segmentOnly
                                            ? 'Breakdown with 2 tabs: Dashboard and Segments.'
                                            : 'Detailed breakdown with 3 tabs: Dashboard, Users, and Segments.'}
                                    </p>
                                </div>
                                <button className="btn btn-ghost" onClick={() => window.open(excelInfo.downloadUrl)}>
                                    <Download size={18} /> Download
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="btn btn-ghost" onClick={() => setStep('reconcile')}>Go Back</button>
                                <button className="btn btn-primary" onClick={createStripeInvoice} disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Proceed to Stripe'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Modal for Status confirmation */}
                    <AnimatePresence>
                        {showStatusModal && (
                            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    className="glass-card" style={{ maxWidth: '450px', padding: '2.5rem', textAlign: 'center' }}
                                >
                                    <ShieldAlert size={64} color="var(--warning)" style={{ margin: '0 auto 1.5rem' }} />
                                    <h2 style={{ marginBottom: '1rem' }}>Confirm Agency Status</h2>
                                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                                        The agency status is currently set to <strong>"{statusToConfirm}"</strong>.
                                        Please confirm before proceeding with invoice creation.
                                    </p>
                                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                        <button className="btn btn-ghost" onClick={() => setShowStatusModal(false)}>Cancel</button>
                                        <button className="btn btn-primary" onClick={generateExcel}>Proceed Anyway</button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {step === 'stripe' && stripeInfo && (
                        <div className="animate-fade-in">
                            <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Step 3: Stripe Invoice Preview</h2>
                            <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>FINALIZED STRIPE INVOICE</span>
                                        <h3 style={{ fontSize: '1.5rem' }}>${stripeInfo.total.toFixed(2)} USD</h3>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>INVOICE NUMBER</span>
                                        <p style={{ fontFamily: 'monospace', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>{stripeInfo.invoiceNumber}</p>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>RECIPIENT EMAIL</span>
                                        <p style={{ fontSize: '0.9rem', margin: 0 }}>{stripeInfo.customerEmail}</p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button className="btn btn-ghost" onClick={() => window.open(stripeInfo.invoiceUrl)}>
                                        Preview Invoice <ExternalLink size={14} />
                                    </button>
                                    {stripeInfo.dashboardUrl && (
                                        <button className="btn btn-ghost" onClick={() => window.open(stripeInfo.dashboardUrl)}>
                                            Edit in Dashboard <ExternalLink size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="btn btn-ghost" onClick={() => setStep('excel')}>Go Back</button>
                                <button
                                    className="btn btn-primary"
                                    style={{ background: 'var(--success)', border: 'none' }}
                                    disabled={loading}
                                    onClick={async () => {
                                        setLoading(true);
                                        try {
                                            const res = await fetch(`/api/send-invoice/${stripeInfo.stripeInvoiceId}`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    agencyId: data.agency.id,
                                                    agencyName: data.agency.name,
                                                    amount: stripeInfo.total,
                                                    period: data.billingPeriod,
                                                    invoiceType: segmentOnly ? 'CFP' : 'Host'
                                                })
                                            });
                                            if (res.ok) {
                                                alert(`${segmentOnly ? 'CFP' : 'Host'} Invoice Sent Successfully!`);
                                                onBack();
                                            }
                                        } catch (err) {
                                            alert('Error sending invoice');
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle size={18} /> Approve & Send</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

const StepItem = ({ label, active, done }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', opacity: active || done ? 1 : 0.4, color: active ? 'var(--primary)' : 'var(--text-main)' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: done ? 'var(--success)' : active ? 'var(--primary)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            {done ? <CheckCircle size={16} /> : active ? <Loader2 size={16} className="animate-spin" /> : null}
        </div>
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{label}</span>
    </div>
);

const StatCard = ({ label, value, color }) => (
    <div className="glass-card" style={{ padding: '1rem', textAlign: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
        <h3 style={{ fontSize: '1.75rem', marginTop: '0.25rem', color: color || 'var(--text-main)' }}>{value}</h3>
    </div>
);

export default PipelineView;
