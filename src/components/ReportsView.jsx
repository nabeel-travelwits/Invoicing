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
    X,
    Clock
} from 'lucide-react';
import { motion } from 'framer-motion';

const ReportsView = ({ user, logEvent }) => {
    const [loading, setLoading] = useState(false);
    const [reportType, setReportType] = useState('bookings');
    const [dateRange, setDateRange] = useState(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            from: start.toISOString().slice(0, 10),
            to: end.toISOString().slice(0, 10)
        };
    });


    const [invoiceData, setInvoiceData] = useState({ host: [], cfp: [] });
    const [userData, setUserData] = useState([]);
    const [bookingData, setBookingData] = useState({ total: 0, cfp: 0, host: 0, cfpByAgency: [], hostByAgency: [], byDate: [] });
    const [selectedAgency, setSelectedAgency] = useState(null);

    const fetchInvoiceReports = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reports/invoices?from=${dateRange.from}&to=${dateRange.to}`);
            const data = await res.json();
            setInvoiceData(data);
        } catch (err) {
            console.error('Failed to fetch invoice reports:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserReports = async (agencyId) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reports/users/${agencyId}`);
            const data = await res.json();
            setUserData(data);
        } catch (err) {
            console.error('Failed to fetch user reports:', err);
        } finally {
            setLoading(false);
        }
    };

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
        if (reportType === 'invoices' && user) fetchInvoiceReports();
        else if (reportType === 'bookings') fetchBookingReports();
        else if (reportType === 'users' && !user) setReportType('bookings');
    }, [reportType, dateRange, user]);

    const exportInvoicesToPDF = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Invoice Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { color: #333; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                        th { background-color: #4f46e5; color: white; }
                        tr:nth-child(even) { background-color: #f2f2f2; }
                    </style>
                </head>
                <body>
                    <h1>Invoice Report</h1>
                    <p>Date Range: ${dateRange.from} to ${dateRange.to}</p>
                    <h2>Host Invoices</h2>
                    <table>
                        <thead><tr><th>Agency</th><th>Invoice #</th><th>Date</th><th>Amount</th></tr></thead>
                        <tbody>
                            ${invoiceData.host.map(inv => `
                                <tr>
                                    <td>${inv.agencyName}</td>
                                    <td>${inv.invoiceNumber}</td>
                                    <td>${new Date(inv.timestamp).toLocaleDateString()}</td>
                                    <td>$${inv.amount.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <h2>CFP Invoices</h2>
                    <table>
                        <thead><tr><th>Agency</th><th>Invoice #</th><th>Date</th><th>Amount</th></tr></thead>
                        <tbody>
                            ${invoiceData.cfp.map(inv => `
                                <tr>
                                    <td>${inv.agencyName}</td>
                                    <td>${inv.invoiceNumber}</td>
                                    <td>${new Date(inv.timestamp).toLocaleDateString()}</td>
                                    <td>$${inv.amount.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 250);
    };

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Reports & Analytics</h1>
                <p style={{ color: 'var(--text-muted)' }}>Comprehensive insights into invoices, users, and bookings</p>
            </header>

            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {user && (
                        <>
                            <button
                                className={`btn btn-sm ${reportType === 'invoices' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setReportType('invoices')}
                            >
                                <FileText size={16} /> <span className="hide-tablet">Invoice Reports</span>
                            </button>
                            <button
                                className={`btn btn-sm ${reportType === 'users' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setReportType('users')}
                            >
                                <Users size={16} /> <span className="hide-tablet">User Reports</span>
                            </button>
                        </>
                    )}
                    <button
                        className={`btn btn-sm ${reportType === 'bookings' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => { setReportType('bookings'); if (logEvent) logEvent('Changed Report View', 'Booking Reports'); }}
                    >
                        <BarChart3 size={16} /> <span className="hide-tablet">Booking Reports</span>
                    </button>

                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        <Calendar size={16} color="var(--text-muted)" />
                        <input
                            type="date"
                            value={dateRange.from}
                            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                            style={{ padding: '0.3rem', fontSize: '0.85rem' }}
                        />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
                        <input
                            type="date"
                            value={dateRange.to}
                            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                            style={{ padding: '0.3rem', fontSize: '0.85rem' }}
                        />
                    </div>
                </div>
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <Loader2 className="animate-spin" size={48} color="var(--primary)" />
                    <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading report data...</p>
                </div>
            )}

            {reportType === 'invoices' && !loading && (
                <div style={{ display: 'grid', gap: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button className="btn btn-primary" onClick={exportInvoicesToPDF}>
                            <Download size={18} /> Export PDF
                        </button>
                    </div>
                    <InvoiceReportSection title="Host Agency Invoices" data={invoiceData.host} type="host" />
                    <InvoiceReportSection title="CFP Affiliate Invoices" data={invoiceData.cfp} type="cfp" />
                </div>
            )}

            {reportType === 'users' && !loading && (
                <UserReportSection
                    onSelectAgency={(id) => {
                        setSelectedAgency(id);
                        fetchUserReports(id);
                    }}
                    userData={userData}
                    selectedAgency={selectedAgency}
                />
            )}

            {reportType === 'bookings' && !loading && (
                <BookingReportSection data={bookingData} dateRange={dateRange} />
            )}
        </div>
    );
};

const InvoiceReportSection = ({ title, data, type }) => {
    const totalAmount = data.reduce((sum, inv) => sum + inv.amount, 0);
    const totalCount = data.length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card"
            style={{ padding: '2rem' }}
        >
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={24} color={type === 'host' ? 'var(--primary)' : 'var(--warning)'} />
                {title}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <StatCard label="Total Invoices" value={totalCount} icon={<FileText size={20} />} />
                <StatCard label="Total Revenue" value={`$${totalAmount.toFixed(2)}`} icon={<DollarSign size={20} />} color="var(--success)" />
                <StatCard label="Average Invoice" value={`$${(totalAmount / (totalCount || 1)).toFixed(2)}`} icon={<TrendingUp size={20} />} />
            </div>

            {data.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                                <th style={{ padding: '1rem' }}>Agency</th>
                                <th style={{ padding: '1rem' }}>Invoice #</th>
                                <th style={{ padding: '1rem' }}>Date</th>
                                <th style={{ padding: '1rem' }}>Amount</th>
                                <th style={{ padding: '1rem' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((inv, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 600 }}>{inv.agencyName}</td>
                                    <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>{inv.invoiceNumber}</td>
                                    <td style={{ padding: '1rem' }}>{new Date(inv.timestamp).toLocaleDateString()}</td>
                                    <td style={{ padding: '1rem', fontWeight: 700 }}>${inv.amount.toFixed(2)}</td>
                                    <td style={{ padding: '1rem' }}>
                                        {inv.emailSent ? (
                                            <span className="badge badge-success">Sent</span>
                                        ) : (
                                            <span className="badge">Draft</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No invoices found for this period</p>
            )}
        </motion.div>
    );
};

const UserReportSection = ({ onSelectAgency, userData, selectedAgency }) => {
    const [agencies, setAgencies] = useState([]);

    useEffect(() => {
        fetch('/api/agencies').then(r => r.json()).then(setAgencies);
    }, []);

    const exportUsersToPDF = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>User Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { color: #333; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                        th { background-color: #4f46e5; color: white; }
                        tr:nth-child(even) { background-color: #f2f2f2; }
                    </style>
                </head>
                <body>
                    <h1>User Report</h1>
                    <table>
                        <thead><tr><th>Name</th><th>Email</th><th>Signed Up</th><th>Deactivated</th><th>Status</th></tr></thead>
                        <tbody>
                            ${userData.map(user => `
                                <tr>
                                    <td>${user.name}</td>
                                    <td>${user.email}</td>
                                    <td>${user.activationDate ? new Date(user.activationDate).toLocaleDateString() : '-'}</td>
                                    <td>${user.deactivationDate ? new Date(user.deactivationDate).toLocaleDateString() : '-'}</td>
                                    <td>${user.status}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 250);
    };

    return (
        <div style={{ display: 'grid', gap: '2rem' }}>
            <div className="glass-card" style={{ padding: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'white' }}>Select Agency for User Report</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                    {agencies.map(agency => (
                        <button
                            key={agency.id}
                            className={`glass-card ${selectedAgency === agency.id ? 'active-card' : ''}`}
                            onClick={() => onSelectAgency(agency.id)}
                            style={{
                                padding: '1.5rem',
                                textAlign: 'left',
                                cursor: 'pointer',
                                border: selectedAgency === agency.id ? '2px solid var(--primary)' : 'none'
                            }}
                        >
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{agency.name}</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {agency.id}</p>
                        </button>
                    ))}
                </div>
            </div>

            {selectedAgency && userData.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card"
                    style={{ padding: '2rem' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.5rem' }}>User Details</h2>
                        <button className="btn btn-primary" onClick={exportUsersToPDF}>
                            <Download size={18} /> Export PDF
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                        <StatCard label="Total Users" value={userData.length} icon={<Users size={20} />} />
                        <StatCard
                            label="Active Users"
                            value={userData.filter(u => u.status === 'Active').length}
                            icon={<Users size={20} />}
                            color="var(--success)"
                        />
                        <StatCard
                            label="Deactivated"
                            value={userData.filter(u => u.status === 'Deactivated').length}
                            icon={<Users size={20} />}
                            color="var(--error)"
                        />
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                                <th style={{ padding: '1rem' }}>Name</th>
                                <th style={{ padding: '1rem' }}>Email</th>
                                <th style={{ padding: '1rem' }}>Signed Up</th>
                                <th style={{ padding: '1rem' }}>Deactivated</th>
                                <th style={{ padding: '1rem' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {userData.map((user, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 600 }}>{user.name}</td>
                                    <td style={{ padding: '1rem' }}>{user.email}</td>
                                    <td style={{ padding: '1rem' }}>{user.activationDate ? new Date(user.activationDate).toLocaleDateString() : '-'}</td>
                                    <td style={{ padding: '1rem' }}>{user.deactivationDate ? new Date(user.deactivationDate).toLocaleDateString() : '-'}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span className={`badge ${user.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                                            {user.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </motion.div>
            )}
        </div>
    );
};

const BookingReportSection = ({ data, dateRange }) => {
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
                            <div style="font-size: 28px; font-weight: bold;">${data.total}</div>
                            <div style="color: #666; margin-top: 5px;">Total Bookings</div>
                        </div>
                        <div class="summary-card">
                            <div style="font-size: 28px; font-weight: bold; color: #f59e0b;">${data.cfp}</div>
                            <div style="color: #666; margin-top: 5px;">CFP Bookings</div>
                        </div>
                        <div class="summary-card">
                            <div style="font-size: 28px; font-weight: bold; color: #6366f1;">${data.host}</div>
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
                            ${(data.cfpByAgency || []).map(agency => {
            const percentage = data.cfp > 0 ? ((agency.count / data.cfp) * 100).toFixed(1) : 0;
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
                            ${(data.hostByAgency || []).map(agency => {
            const percentage = data.host > 0 ? ((agency.count / data.host) * 100).toFixed(1) : 0;
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
        <div style={{ display: 'grid', gap: '2rem' }}>
            <div className="glass-card" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem' }}>Booking Statistics</h2>
                    <button className="btn btn-primary" onClick={exportToPDF}>
                        <Download size={18} /> Export PDF
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    <StatCard label="Total Bookings" value={data.total} icon={<BarChart3 size={20} />} />
                    <StatCard label="CFP Bookings" value={data.cfp} icon={<BarChart3 size={20} />} color="var(--warning)" />
                    <StatCard label="Host Bookings" value={data.host} icon={<BarChart3 size={20} />} color="var(--primary)" />
                    <StatCard label="Cancelled Bookings" value={data.statuses?.Cancelled || 0} icon={<X size={20} />} color="var(--error)" />
                    <StatCard label="Quotes" value={data.statuses?.Quote || 0} icon={<FileText size={20} />} color="var(--success)" />
                    <StatCard label="On Hold Bookings" value={data.statuses?.['On Hold'] || 0} icon={<Clock size={20} />} color="var(--text-muted)" />
                </div>

                {/* CFP Bookings by Agency */}
                {data.cfpByAgency && data.cfpByAgency.length > 0 && (
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
                                    {data.cfpByAgency.map((agency, i) => {
                                        const percentage = data.cfp > 0 ? ((agency.count / data.cfp) * 100).toFixed(1) : 0;
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
                {data.hostByAgency && data.hostByAgency.length > 0 && (
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
                                    {data.hostByAgency.map((agency, i) => {
                                        const percentage = data.host > 0 ? ((agency.count / data.host) * 100).toFixed(1) : 0;
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

export default ReportsView;
