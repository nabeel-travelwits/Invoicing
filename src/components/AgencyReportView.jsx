import React, { useState, useEffect } from 'react';
import {
    Calendar, Users, BarChart3, Download, Loader2, ArrowLeft, ArrowUpRight, PieChart
} from 'lucide-react';
import { motion } from 'framer-motion';

const AgencyReportView = ({ isLoggedIn }) => {
    // Extract agency name from URL path: /reporting/:agencyName
    const pathParts = window.location.pathname.split('/');
    const agencyNameFromUrl = decodeURIComponent(pathParts[pathParts.length - 1]);

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [dateRange, setDateRange] = useState(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            from: start.toISOString().slice(0, 10),
            to: end.toISOString().slice(0, 10)
        };
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reports/agency-details?name=${encodeURIComponent(agencyNameFromUrl)}&from=${dateRange.from}&to=${dateRange.to}`);
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [dateRange]);

    const exportToPDF = () => {
        if (!data) return;

        // Filter for PDF as well
        const hostBookings = data.bookings.filter(b => b.loggedInUserEmail);

        // Status counts html
        const statusHtml = Object.entries(data.statusCounts || {}).map(([status, count]) =>
            `<div style="display:inline-block; margin-right:15px; background:#f0f0f0; padding:5px 10px; border-radius:4px;"><strong>${status}:</strong> ${count}</div>`
        ).join('');

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>${data.agencyName} Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1, h2 { color: #ddd; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; font-size: 12px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #4f46e5; color: white; }
                        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
                        .card { background: #f9f9f9; padding: 15px; border-radius: 5px; text-align: center; }
                        .metric { font-size: 24px; font-weight: bold; color: #4f46e5; }
                        .status-container { margin: 20px 0; padding: 10px; border: 1px solid #eee; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <h1>${data.agencyName} - Performance Report</h1>
                    <p>Period: ${dateRange.from} to ${dateRange.to}</p>
                    
                    <div class="summary">
                        <div class="card"><div class="metric">${data.summary.totalUsers}</div><div>Total Users</div></div>
                        <div class="card"><div class="metric">${data.summary.totalBookings}</div><div>Total Bookings</div></div>
                        <div class="card"><div class="metric" style="color: #f59e0b">${data.summary.cfpBookings}</div><div>CFP Bookings</div></div>
                        <div class="card"><div class="metric" style="color: #6366f1">${data.summary.hostBookings}</div><div>Host Bookings</div></div>
                    </div>

                    <div class="status-container">
                        <h3>Booking Status Breakdown</h3>
                        ${statusHtml}
                    </div>

                    <h2>User Roster</h2>
                    <table>
                        <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Signed Up</th></tr></thead>
                        <tbody>
                            ${data.users.length === 0 ? '<tr><td colspan="4">No users found.</td></tr>' :
                data.users.map(u => `
                                <tr>
                                    <td>${u.name || '-'}</td>
                                    <td>${u.email || '-'}</td>
                                    <td>${u.status || '-'}</td>
                                    <td>${u.activationDate ? new Date(u.activationDate).toLocaleDateString() : '-'}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>

                    <h2>Host Bookings Summary</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Trip ID</th>
                                <th>Creation Date</th>
                                <th>Advisor Email</th>
                                <th>GDS Record</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${hostBookings.length === 0 ? '<tr><td colspan="4">No bookings found.</td></tr>' :
                hostBookings.map(b => `
                                <tr>
                                    <td>${b.TripID || b['Trip ID'] || b.BookingID || b.id}</td>
                                    <td>${b.TripCreationDate || b['Trip Creation Date'] || b['TripCreatedDate'] || '-'}</td>
                                    <td>${b.loggedInUserEmail || '-'}</td>
                                    <td>${b.GDSRecordLocator || b['GDS Record Locator'] || b['GDSRecord'] || '-'}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 250);
    };

    if (loading && !data) {
        return <div style={{ display: 'flex', justifyContent: 'center', height: '100vh', alignItems: 'center' }}><Loader2 className="animate-spin" /></div>;
    }

    if (!data) return <div>No data found for this agency.</div>;

    // Filter only Host bookings for the View
    const hostBookings = data.bookings.filter(b => b.loggedInUserEmail);
    const maxVal = Math.max(...(data.graphData || []).map(d => Math.max(d.users, d.bookings)), 1);

    return (
        <div className="animate-fade-in" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', color: 'white' }}>
            {isLoggedIn && (
                <button
                    className="btn btn-ghost"
                    onClick={() => window.location.href = '/'}
                    style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0' }}
                >
                    <ArrowLeft size={18} /> Back to Dashboard
                </button>
            )}
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{data.agencyName}</h1>
                    <p style={{ opacity: 0.7 }}>Agency Performance Report</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="glass-card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={16} />
                        <input type="date" value={dateRange.from} onChange={e => setDateRange({ ...dateRange, from: e.target.value })} style={{ background: 'transparent', border: 'none', color: 'white' }} />
                        <span>to</span>
                        <input type="date" value={dateRange.to} onChange={e => setDateRange({ ...dateRange, to: e.target.value })} style={{ background: 'transparent', border: 'none', color: 'white' }} />
                    </div>
                    <button className="btn btn-primary" onClick={exportToPDF}><Download size={18} /> Export PDF</button>
                </div>
            </header>

            {/* Main Stats */}
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', opacity: 0.8 }}>Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                <StatCard label="Total Users" value={data.summary.totalUsers} icon={<Users size={24} />} delay={0} />
                <StatCard label="Total Bookings" value={data.summary.totalBookings} icon={<BarChart3 size={24} />} delay={0.1} />
                <StatCard label="CFP Bookings" value={data.summary.cfpBookings} icon={<ArrowUpRight size={24} />} color="var(--warning)" delay={0.2} />
                <StatCard label="Host Bookings" value={data.summary.hostBookings} icon={<Users size={24} />} color="var(--primary)" delay={0.3} />
            </div>

            {/* Status Breakdown Section */}
            {(data.statusCounts && Object.keys(data.statusCounts).length > 0) && (
                <div style={{ marginBottom: '3rem' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', opacity: 0.8 }}>Booking Status Breakdown</h3>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {Object.entries(data.statusCounts).sort(([, a], [, b]) => b - a).map(([status, count], i) => (
                            <motion.div
                                key={status}
                                className="glass-card"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.05 }}
                                style={{ padding: '1rem 1.5rem', minWidth: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                            >
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '5px' }}>{status}</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{count}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Graphs */}
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', opacity: 0.8 }}>Monthly Trends</h3>
            <div className="glass-card" style={{ padding: '2rem', marginBottom: '3rem', overflowX: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', height: '300px', gap: '2rem', paddingBottom: '2rem', minWidth: '800px', paddingTop: '20px' }}>
                    {(data.graphData || []).map((item, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', justifyContent: 'flex-end', height: '100%' }}>
                            <div style={{ display: 'flex', gap: '6px', height: '100%', alignItems: 'flex-end', justifyContent: 'center' }}>
                                {/* User Bar */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                                    {item.users > 0 && <span style={{ fontSize: '0.7rem', marginBottom: '2px', color: '#3b82f6' }}>{item.users}</span>}
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: `${(item.users / maxVal) * 100}%` }}
                                        style={{ width: '20px', background: '#3b82f6', borderRadius: '4px 4px 0 0' }}
                                    />
                                </div>
                                {/* Booking Bar */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                                    {item.bookings > 0 && <span style={{ fontSize: '0.7rem', marginBottom: '2px', color: '#10b981' }}>{item.bookings}</span>}
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: `${(item.bookings / maxVal) * 100}%` }}
                                        style={{ width: '20px', background: '#10b981', borderRadius: '4px 4px 0 0' }}
                                    />
                                </div>
                            </div>
                            <div style={{ textAlign: 'center', fontSize: '0.75rem', marginTop: '10px', transform: 'rotate(-45deg)', transformOrigin: 'top left', whiteSpace: 'nowrap' }}>
                                {item.month}
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: 12, height: 12, background: '#3b82f6' }}></div>Users</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: 12, height: 12, background: '#10b981' }}></div>Bookings</div>
                </div>
            </div>

            {/* Detailed Tables */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Users List */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Recent Users</h3>
                    <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <th style={{ textAlign: 'left', padding: '10px' }}>Name</th>
                                    <th style={{ textAlign: 'left', padding: '10px' }}>Signed Up</th>
                                    <th style={{ textAlign: 'left', padding: '10px' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.users.length === 0 ? (
                                    <tr><td colSpan="3" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No users found for this date range.</td></tr>
                                ) : (
                                    data.users.slice(0, 50).map((u, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '10px' }}>{u.name}</td>
                                            <td style={{ padding: '10px' }}>{u.activationDate ? new Date(u.activationDate).toLocaleDateString() : '-'}</td>
                                            <td style={{ padding: '10px' }}>
                                                <span style={{
                                                    background: u.status === 'Active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                                    color: u.status === 'Active' ? '#10b981' : '#ef4444',
                                                    padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'
                                                }}>{u.status || 'Active'}</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Host Bookings Summary */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Host Bookings Summary</h3>
                    <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <th style={{ textAlign: 'left', padding: '10px' }}>Creation Date</th>
                                    <th style={{ textAlign: 'left', padding: '10px' }}>Trip ID</th>
                                    <th style={{ textAlign: 'left', padding: '10px' }}>Advisor Email</th>
                                    <th style={{ textAlign: 'left', padding: '10px' }}>GDS Record</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hostBookings.length === 0 ? (
                                    <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No host bookings found.</td></tr>
                                ) : (
                                    hostBookings.slice(0, 50).map((b, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '10px' }}>{b.TripCreationDate ? new Date(b.TripCreationDate).toLocaleDateString() : '-'}</td>
                                            <td style={{ padding: '10px' }}>{b.TripID || b['Trip ID'] || b.BookingID || b.id}</td>
                                            <td style={{ padding: '10px' }}>{b.loggedInUserEmail}</td>
                                            <td style={{ padding: '10px' }}>{b.GDSRecordLocator || b['GDS Record Locator'] || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ label, value, icon, color, delay }) => (
    <motion.div
        className="glass-card"
        style={{ padding: '1.5rem' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
    >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{label}</span>
            <div style={{ color: color || 'var(--text-main)', opacity: 0.8 }}>{icon}</div>
        </div>
        <div style={{ fontSize: '2rem', fontWeight: 800 }}>{value}</div>
    </motion.div>
);

export default AgencyReportView;
