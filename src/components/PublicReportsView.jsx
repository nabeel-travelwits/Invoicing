import React, { useState, useEffect } from 'react';
import {
    Calendar,
    TrendingUp,
    Users,
    DollarSign,
    FileText,
    Building2,
    Loader2,
    Download,
    BarChart3,
    Lock
} from 'lucide-react';
import { motion } from 'framer-motion';

// This is a public version of ReportsView that doesn't require authentication
const PublicReportsView = () => {
    const [loading, setLoading] = useState(false);
    const [reportType, setReportType] = useState('bookings'); // Only show bookings publicly
    const [dateRange, setDateRange] = useState({
        from: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 10),
        to: new Date().toISOString().slice(0, 10)
    });

    const [bookingData, setBookingData] = useState({ total: 0, cfp: 0, host: 0, cfpByAgency: [], hostByAgency: [], byDate: [] });

    const fetchBookingReports = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reports/bookings?from=${dateRange.from}&to=${dateRange.to}`);
            const data = await res.json();
            setBookingData(data);
        } catch (err) {
            console.error('Failed to fetch booking reports:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBookingReports();
    }, [dateRange]);

    const exportToPDF = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Booking Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1, h2 { color: #333; }
                        h2.cfp { color: #f59e0b; }
                        h2.host { color: #6366f1; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; }
                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                        th { background-color: #4f46e5; color: white; }
                        tr:nth-child(even) { background-color: #f2f2f2; }
                        .summary { background: #f0f0f0; padding: 15px; margin: 20px 0; border-radius: 8px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                        .summary-card { background: white; padding: 15px; border-radius: 4px; text-align: center; }
                    </style>
                </head>
                <body>
                    <h1>Booking Report</h1>
                    <p><strong>Date Range:</strong> ${dateRange.from} to ${dateRange.to}</p>
                    
                    <div class="summary">
                        <div class="summary-card">
                            <div style="font-size: 28px; font-weight: bold;">${bookingData.total}</div>
                            <div style="color: #666; margin-top: 5px;">Total Bookings</div>
                        </div>
                        <div class="summary-card">
                            <div style="font-size: 28px; font-weight: bold; color: #f59e0b;">${bookingData.cfp}</div>
                            <div style="color: #666; margin-top: 5px;">CFP Bookings</div>
                        </div>
                        <div class="summary-card">
                            <div style="font-size: 28px; font-weight: bold; color: #6366f1;">${bookingData.host}</div>
                            <div style="color: #666; margin-top: 5px;">Host Bookings</div>
                        </div>
                    </div>
                    
                    <h2 class="cfp">CFP Bookings by Agency</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Agency Name</th>
                                <th>Booking Count</th>
                                <th>Percentage of CFP</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(bookingData.cfpByAgency || []).map(agency => {
            const percentage = bookingData.cfp > 0 ? ((agency.count / bookingData.cfp) * 100).toFixed(1) : 0;
            return `
                                    <tr>
                                        <td><strong>${agency.agencyName}</strong></td>
                                        <td>${agency.count}</td>
                                        <td>${percentage}%</td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                    
                    <h2 class="host">Host Bookings by Agency</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Agency Name</th>
                                <th>Booking Count</th>
                                <th>Percentage of Host</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(bookingData.hostByAgency || []).map(agency => {
            const percentage = bookingData.host > 0 ? ((agency.count / bookingData.host) * 100).toFixed(1) : 0;
            return `
                                    <tr>
                                        <td><strong>${agency.agencyName}</strong></td>
                                        <td>${agency.count}</td>
                                        <td>${percentage}%</td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                    
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #666;">
                        <p>Generated on ${new Date().toLocaleString()}</p>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 250);
    };

    return (
        <div className="animate-fade-in" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '2rem' }}>
            <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem', color: 'white' }}>📊 Public Booking Reports</h1>
                    <p style={{ color: 'rgba(255,255,255,0.9)' }}>Real-time booking analytics - No login required</p>
                </header>

                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <Calendar size={18} color="var(--text-muted)" />
                            <input
                                type="date"
                                value={dateRange.from}
                                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                                style={{ padding: '0.5rem' }}
                            />
                            <span style={{ color: 'var(--text-muted)' }}>to</span>
                            <input
                                type="date"
                                value={dateRange.to}
                                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                                style={{ padding: '0.5rem' }}
                            />
                        </div>
                        <button className="btn btn-primary" onClick={exportToPDF}>
                            <Download size={18} /> Export PDF
                        </button>
                    </div>
                </div>

                {loading && (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <Loader2 className="animate-spin" size={48} color="white" />
                        <p style={{ marginTop: '1rem', color: 'white' }}>Loading report data...</p>
                    </div>
                )}

                {!loading && (
                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem' }}>Booking Statistics</h2>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                            <StatCard label="Total Bookings" value={bookingData.total} icon={<BarChart3 size={20} />} />
                            <StatCard label="CFP Bookings" value={bookingData.cfp} icon={<BarChart3 size={20} />} color="var(--warning)" />
                            <StatCard label="Host Bookings" value={bookingData.host} icon={<BarChart3 size={20} />} color="var(--primary)" />
                        </div>

                        {/* CFP Bookings by Agency */}
                        {bookingData.cfpByAgency && bookingData.cfpByAgency.length > 0 && (
                            <div style={{ marginTop: '2rem', marginBottom: '3rem' }}>
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--warning)' }}>CFP Bookings by Agency</h3>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                                                <th style={{ padding: '1rem' }}>Agency Name</th>
                                                <th style={{ padding: '1rem' }}>Booking Count</th>
                                                <th style={{ padding: '1rem' }}>Percentage of CFP</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bookingData.cfpByAgency.map((agency, i) => {
                                                const percentage = bookingData.cfp > 0 ? ((agency.count / bookingData.cfp) * 100).toFixed(1) : 0;
                                                return (
                                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <td style={{ padding: '1rem', fontWeight: 600 }}>{agency.agencyName}</td>
                                                        <td style={{ padding: '1rem' }}>{agency.count}</td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', maxWidth: '100px' }}>
                                                                    <motion.div
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${percentage}%` }}
                                                                        style={{ height: '100%', background: 'var(--warning)' }}
                                                                    />
                                                                </div>
                                                                <span>{percentage}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Host Bookings by Agency */}
                        {bookingData.hostByAgency && bookingData.hostByAgency.length > 0 && (
                            <div style={{ marginTop: '2rem' }}>
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--primary)' }}>Host Bookings by Agency</h3>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                                                <th style={{ padding: '1rem' }}>Agency Name</th>
                                                <th style={{ padding: '1rem' }}>Booking Count</th>
                                                <th style={{ padding: '1rem' }}>Percentage of Host</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bookingData.hostByAgency.map((agency, i) => {
                                                const percentage = bookingData.host > 0 ? ((agency.count / bookingData.host) * 100).toFixed(1) : 0;
                                                return (
                                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <td style={{ padding: '1rem', fontWeight: 600 }}>{agency.agencyName}</td>
                                                        <td style={{ padding: '1rem' }}>{agency.count}</td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', maxWidth: '100px' }}>
                                                                    <motion.div
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${percentage}%` }}
                                                                        style={{ height: '100%', background: 'var(--primary)' }}
                                                                    />
                                                                </div>
                                                                <span>{percentage}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div style={{ marginTop: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.8)' }}>
                    <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Lock size={16} /> This is a public view. For full access, please log in to the system.
                    </p>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ label, value, icon, color }) => (
    <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
        <div style={{ color: color || 'var(--primary)', marginBottom: '0.5rem' }}>{icon}</div>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: color || 'var(--text-main)', marginBottom: '0.25rem' }}>{value}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
    </div>
);

export default PublicReportsView;
