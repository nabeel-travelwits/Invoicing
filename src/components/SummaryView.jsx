import React, { useState, useEffect } from 'react';
import { Loader2, DollarSign } from 'lucide-react';
import { ProgressBar } from './ProgressBar';

const SummaryView = ({ agencies }) => {
    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [billingPeriod, setBillingPeriod] = useState(() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return date.toISOString().slice(0, 7);
    });

    const generateSummary = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/batch-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agencyIds: agencies.map(a => a.id),
                    billingPeriod
                })
            });
            const result = await res.json();
            setSummaryData(result);
        } catch (err) {
            console.error(err);
            alert('Failed to generate summary');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <ProgressBar visible={loading} text="Calculating Batch Summary..." subtext="Accessing multiple data sources..." />
            <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem' }}>Monthly Financial Estimator</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Generate a rough estimate of earnings for all {agencies.length} active agencies.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input
                        type="month"
                        value={billingPeriod}
                        onChange={(e) => setBillingPeriod(e.target.value)}
                        style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}
                    />
                    <button className="btn btn-primary" onClick={generateSummary} disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" size={18} /> : 'Calculate Totals'}
                    </button>
                </div>
            </div>

            {summaryData && (
                <div className="glass-card" style={{ padding: '2rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '1rem' }}>Host Agency</th>
                                <th style={{ padding: '1rem' }}>Users</th>
                                <th style={{ padding: '1rem' }}>Segments</th>
                                <th style={{ padding: '1rem' }}>Prorated</th>
                                <th style={{ padding: '1rem' }}>Rate/User</th>
                                <th style={{ padding: '1rem' }}>Prorated Amt</th>
                                <th style={{ padding: '1rem', textAlign: 'right' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaryData.items.map((item, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>{item.name}</td>
                                    <td style={{ padding: '1rem' }}>{item.totalUsers}</td>
                                    <td style={{ padding: '1rem' }}>{item.segments}</td>
                                    <td style={{ padding: '1rem' }}>{item.proratedUsers}</td>
                                    <td style={{ padding: '1rem' }}>${item.userRate}</td>
                                    <td style={{ padding: '1rem' }}>${item.proratedAmount.toFixed(2)}</td>
                                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>${item.total.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop: '2px solid var(--primary)', background: 'rgba(99, 102, 241, 0.1)' }}>
                                <td colSpan={6} style={{ padding: '1.5rem', fontWeight: 700, fontSize: '1.1rem' }}>GRAND TOTAL ESTIMATE</td>
                                <td style={{ padding: '1.5rem', textAlign: 'right', fontWeight: 800, fontSize: '1.5rem', color: 'var(--success)' }}>
                                    ${summaryData.grandTotal.toFixed(2)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SummaryView;
