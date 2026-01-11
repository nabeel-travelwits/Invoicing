import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Clock,
  Search,
  Plus,
  ArrowRight,
  Loader2,
  History,
  LayoutDashboard,
  CheckCircle2,
  X,
  Database,
  Users,
  Settings,
  LogOut,
  Package,
  FileText,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PipelineView from './components/PipelineView';
import ConfigModal from './components/ConfigModal';
import { ProgressBar } from './components/ProgressBar';
import Login from './components/Login';
import SummaryView from './components/SummaryView';
import BatchCFPView from './components/BatchCFPView';
import ReportsView from './components/ReportsView';

import AgencyReportView from './components/AgencyReportView';

function App() {
  if (window.location.pathname.startsWith('/reporting/')) {
    const isLoggedIn = !!localStorage.getItem('user');
    return <AgencyReportView isLoggedIn={isLoggedIn} />;
  }

  // Handle analytics/reports as potentially public or private routes
  const isAnalyticsPath = window.location.pathname === '/analytics' || window.location.pathname === '/reports';

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const isAdmin = user?.email === 'nabeel@travelwits.com';

  // If viewing analytics as guest, show the restricted ReportsView
  if (isAnalyticsPath && !user) {
    return (
      <div className="container" style={{ paddingTop: '4rem' }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '3rem', color: 'white' }}>📊 Analytics Dashboard</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)' }}>General booking performance. Login for full access.</p>
        </div>
        <ReportsView user={null} />
        <div style={{ marginTop: '3rem', textAlign: 'center' }}>
          <button className="btn btn-primary" onClick={() => window.location.href = '/'}>
            Login for Detailed Reports
          </button>
        </div>
      </div>
    );
  }
  const [agencies, setAgencies] = useState([]);
  const [cfpAgencies, setCfpAgencies] = useState([]);
  const [rawAgencies, setRawAgencies] = useState([]);
  const [rawCfpAgencies, setRawCfpAgencies] = useState([]);
  const [logs, setLogs] = useState([]);
  const [agencyStages, setAgencyStages] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'pipeline', 'logs', 'cfp', 'reports'
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfig, setShowConfig] = useState(null); // ID of agency being configured
  const [loadingProgress, setLoadingProgress] = useState({ visible: false, text: '', percentage: 0 });
  const [newAgency, setNewAgency] = useState({ id: '', name: '', email: '', userPrice: 15.0, segmentPrice: 0.05, sheetId: '1-DilrlkKOa9QJDBi87NhVv9LaXnY_dw0fHwjzfqmCyM' });
  const [excludedIds, setExcludedIds] = useState(() => {
    const saved = localStorage.getItem('excludedIds');
    return saved ? JSON.parse(saved) : [];
  });
  const [showExclusionModal, setShowExclusionModal] = useState(false);
  const [excludeIdInput, setExcludeIdInput] = useState('');

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  const fetchData = async () => {
    setLoadingProgress({ visible: true, text: 'Fetching Agencies & Logs...', percentage: 0 });
    try {
      const results = await Promise.allSettled([
        fetch('/api/agencies').then(r => r.ok ? r.json() : Promise.reject(`Agencies: ${r.status}`)),
        fetch('/api/logs').then(r => r.ok ? r.json() : Promise.reject(`Logs: ${r.status}`)),
        fetch('/api/cfp-agencies').then(r => r.ok ? r.json() : Promise.reject(`CFP: ${r.status}`)),
        fetch('/api/agencies/stages').then(r => r.ok ? r.json() : Promise.reject(`Stages: ${r.status}`))
      ]);

      const [agencyData, logsData, cfpData, stagesData] = results.map(res => res.status === 'fulfilled' ? res.value : []);

      // Log any failures for debugging
      results.forEach((res, i) => {
        if (res.status === 'rejected') {
          console.warn(`Data sync partial failure: ${res.reason}`);
        }
      });

      // Convert array of stages to map {agencyId: stage}
      const stageMap = {};
      if (Array.isArray(stagesData)) {
        stagesData.forEach(s => stageMap[s.agency_id] = s.stage);
      }
      setAgencyStages(stageMap);

      if (agencyData.length > 0) {
        setRawAgencies(agencyData);
        setAgencies(agencyData.filter(a => !excludedIds.includes(String(a.id))));
      }

      if (logsData.length > 0) {
        setLogs(logsData);
      }

      if (cfpData.length > 0) {
        setRawCfpAgencies(cfpData);
        setCfpAgencies(cfpData.filter(a => !excludedIds.includes(String(a.id))));
      }
    } catch (err) {
      console.error('Core data sync failed:', err);
    } finally {
      setLoadingProgress({ visible: false, text: '', percentage: 0 });
      setLoading(false);
    }
  };

  const updateConfig = async (id, config) => {
    try {
      const res = await fetch(`/api/agency-config/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        // Refresh data to reflect changes
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };
  const updateAgencyStage = async (agencyId, stage) => {
    try {
      const res = await fetch('/api/agencies/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyId, stage, updatedBy: user?.email })
      });
      if (res.ok) {
        setAgencyStages(prev => ({ ...prev, [agencyId]: stage }));
        logEvent('Updated Agency Stage', `${stage} for ID: ${agencyId}`, agencyId);
      }
    } catch (err) {
      console.error('Failed to update agency stage:', err);
    }
  };

  useEffect(() => {
    localStorage.setItem('excludedIds', JSON.stringify(excludedIds));
    fetchData(); // Refetch to apply filters

    // Handle direct navigation to analytics/reports
    if (window.location.pathname === '/analytics' || window.location.pathname === '/reports') {
      setView('reports');
    }
  }, [excludedIds]);

  const logEvent = async (action, details = '', agencyId = null, agencyName = '') => {
    try {
      await fetch('/api/logs/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          details,
          agencyId,
          agencyName,
          userEmail: user?.email
        })
      });
    } catch (err) {
      console.warn('Silent log failure:', err);
    }
  };

  const toggleExcludeId = (id) => {
    const sId = String(id);
    const isAdding = !excludedIds.includes(sId);
    setExcludedIds(prev => isAdding ? [...prev, sId] : prev.filter(i => i !== sId));
    logEvent(isAdding ? 'Excluded Agency' : 'Restored Agency', `Agency ID: ${sId}`);
  };

  const handleAddAgency = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/agencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newAgency, status: 'Active' })
      });
      if (res.ok) {
        setShowAddModal(false);
        fetchData();
        logEvent('Created Agency', `${newAgency.name} (ID: ${newAgency.id})`, newAgency.id, newAgency.name);
      }
    } catch (err) {
      alert('Error adding agency');
    }
  };

  const filteredAgencies = (view === 'cfp' ? cfpAgencies : agencies).filter(a => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const nameMatch = a.name && a.name.toLowerCase().includes(query);
    const idMatch = a.id && String(a.id).toLowerCase().includes(query);
    return nameMatch || idMatch;
  });

  const getLatestLog = (agencyId) => {
    return logs.find(log => log.agencyId === agencyId);
  };

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  if (view === 'pipeline' && selectedAgency) {
    return (
      <div className="container" style={{ paddingTop: '4rem' }}>
        <PipelineView
          user={user}
          agency={selectedAgency}
          segmentOnly={selectedAgency.isCFPMode}
          logEvent={logEvent}
          onBack={() => {
            setView(selectedAgency.isCFPMode ? 'cfp' : 'dashboard');
            fetchData();
          }}
        />
      </div>
    );
  }

  if (view === 'batch-cfp') {
    return (
      <div className="container" style={{ paddingTop: '4rem' }}>
        <BatchCFPView
          user={user}
          agencies={cfpAgencies}
          onBack={() => {
            setView('cfp');
            fetchData();
          }}
        />
      </div>
    );
  }

  if (view === 'reports') {
    return (
      <div className="container" style={{ paddingTop: '4rem' }}>
        <ReportsView
          user={user}
          logEvent={logEvent}
          onBack={() => {
            setView('dashboard');
            window.history.pushState({}, '', '/');
          }}
        />
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '4rem' }}>
      <ProgressBar
        visible={loadingProgress.visible}
        text={loadingProgress.text}
        subtext="Synchronizing with Database..."
      />
      <header style={{ marginBottom: '2.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={24} /> HOST AGENCY BILLING
          </h4>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800 }}>
            {view === 'dashboard' ? 'Host Agencies' : view === 'cfp' ? 'CFP Affiliate Sites' : 'Activity Logs'}
          </h1>
        </div>

        <div className="glass-card" style={{ padding: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-container" style={{ position: 'relative', flex: '1 1 200px', display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', paddingLeft: '1rem' }}>
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onBlur={() => searchQuery && logEvent('Performed Search', `Query: "${searchQuery}"`)}
              style={{ border: 'none', background: 'transparent', padding: '0.6rem', color: 'white', outline: 'none', width: '100%' }}
            />
          </div>

          <nav className="header-nav" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
            <button className={`btn btn-sm ${view === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setView('dashboard'); logEvent('Navigated', 'Host Agencies Dashboard'); }}>
              <Users size={16} /> <span className="hide-tablet">Agencies</span>
            </button>
            <button className={`btn btn-sm ${view === 'cfp' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setView('cfp'); logEvent('Navigated', 'CFP Sites Dashboard'); }}>
              <Database size={16} /> <span className="hide-tablet">CFP</span>
            </button>
            <button className={`btn btn-sm ${view === 'invoice-history' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setView('invoice-history'); logEvent('Navigated', 'Invoice History'); }}>
              <History size={16} /> <span className="hide-tablet">Invoices</span>
            </button>
            {isAdmin && (
              <button className={`btn btn-sm ${view === 'system-logs' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setView('system-logs'); logEvent('Navigated', 'System Activity Logs'); }}>
                <FileText size={16} /> <span className="hide-tablet">Logs</span>
              </button>
            )}
            <button className={`btn btn-sm ${view === 'summary' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setView('summary'); logEvent('Navigated', 'Monthly Billing Summary'); }}>
              <LayoutDashboard size={16} /> <span className="hide-tablet">Summary</span>
            </button>
            <button className={`btn btn-sm ${view === 'reports' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setView('reports'); window.history.pushState({}, '', '/analytics'); logEvent('Navigated', 'Advanced Analytics'); }}>
              <BarChart3 size={16} /> <span className="hide-tablet">Analytics</span>
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => { setShowExclusionModal(true); logEvent('Opened Excluded Agencies Modal'); }} style={{ position: 'relative' }}>
              <X size={16} /> <span className="hide-tablet">Excluded</span> {excludedIds.length > 0 && <span className="badge badge-danger" style={{ position: 'absolute', top: '-5px', right: '-5px', fontSize: '0.6rem', padding: '2px 5px' }}>{excludedIds.length}</span>}
            </button>
            <div style={{ width: '1px', height: '20px', background: 'var(--glass-border)', margin: '0 0.25rem' }}></div>
            <button className="btn btn-sm btn-ghost" onClick={handleLogout} title="Logout">
              <LogOut size={16} /> <span className="hide-tablet">Logout</span>
            </button>
          </nav>
        </div>
      </header>

      {view === 'summary' ? (
        <SummaryView agencies={filteredAgencies} />
      ) : (view !== 'invoice-history' && view !== 'system-logs') ? (
        <div>
          {view === 'cfp' && (
            <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem' }}>Batch Operations</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Automate reconciliation, PDF generation, and emailing for all CFP sites at once.</p>
              </div>
              <button className="btn btn-primary" onClick={() => setView('batch-cfp')}>
                <Package size={18} /> Run Batch Invoicing
              </button>
            </div>
          )}

          {showConfig && (
            <ConfigModal
              agency={filteredAgencies.find(a => a.id === showConfig)}
              onClose={() => setShowConfig(null)}
              onUpdate={updateConfig}
            />
          )}

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
            <AnimatePresence>
              {filteredAgencies.map((agency, index) => {
                const latestLog = getLatestLog(agency.id);
                return (
                  <motion.div
                    key={agency.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="glass-card"
                    style={{
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      borderTop: agencyStages[agency.id] === 'Invoice Sent' ? '4px solid var(--success)' :
                        agencyStages[agency.id] === 'Stripe Draft Created' ? '4px solid #a855f7' : // Purple accent
                          agencyStages[agency.id] === 'Draft Created' ? '4px solid var(--primary)' :
                            'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                      <div>
                        <h3 style={{ fontSize: '1.25rem' }}>{agency.name}</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <code style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {agency.id}</code>
                          {agency.agreementType === 'Complex' && <span className="badge badge-warning" style={{ fontSize: '0.6rem' }}>COMPLEX</span>}
                          {agencyStages[agency.id] && (
                            <span
                              className={`badge ${agencyStages[agency.id] === 'Invoice Sent' ? 'badge-success' :
                                agencyStages[agency.id] === 'Stripe Draft Created' ? 'badge-secondary' :
                                  'badge-info'
                                }`}
                              style={{
                                fontSize: '0.6rem',
                                cursor: isAdmin ? 'pointer' : 'default',
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isAdmin) {
                                  const nextStages = ["Draft Created", "Stripe Draft Created", "Invoice Sent", "Clear"];
                                  const current = agencyStages[agency.id];
                                  const currentIndex = nextStages.indexOf(current);
                                  const next = nextStages[(currentIndex + 1) % nextStages.length];
                                  if (next === "Clear") {
                                    updateAgencyStage(agency.id, "");
                                  } else {
                                    updateAgencyStage(agency.id, next);
                                  }
                                }
                              }}
                              title={isAdmin ? "Click to toggle status" : ""}
                            >
                              {agencyStages[agency.id].toUpperCase()}
                            </span>
                          )}
                          {!agencyStages[agency.id] && isAdmin && (
                            <span
                              className="badge"
                              style={{ fontSize: '0.6rem', cursor: 'pointer', border: '1px dashed var(--glass-border)', background: 'transparent' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateAgencyStage(agency.id, "Draft Created");
                              }}
                              title="Click to start workflow"
                            >
                              + STAGE
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'start' }}>
                        {view !== 'cfp' && (
                          <button className="btn btn-ghost" style={{ padding: '5px' }} onClick={() => setShowConfig(agency.id)}>
                            <Settings size={20} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: view === 'cfp' ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                      {view === 'cfp' ? (
                        <div className="glass-card" style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>BOOKING PRICE (Editable)</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontWeight: 700 }}>$</span>
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={agency.segmentPrice || 5}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                fetch('/api/cfp-pricing', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ agencyId: agency.id, price: val })
                                });
                              }}
                              style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                fontWeight: 700,
                                outline: 'none',
                                borderBottom: '1px solid var(--text-muted)'
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="glass-card" style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>USER PRICE</span>
                            <span style={{ fontWeight: 700, display: 'block' }}>${agency.userPrice.toFixed(2)}</span>
                          </div>
                          <div className="glass-card" style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SEGMENT</span>
                            <span style={{ fontWeight: 700, display: 'block' }}>${agency.segmentPrice.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', marginTop: 'auto' }}
                      onClick={() => {
                        setSelectedAgency({ ...agency, isCFPMode: view === 'cfp' });
                        setView('pipeline');
                        logEvent('Started Pipeline', `Agency: ${agency.name}`, agency.id, agency.name);
                      }}
                    >
                      {view === 'cfp' ? 'Generate CFP Invoice' : 'Invoicing Pipeline'} <ArrowRight size={18} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      ) : (view === 'system-logs' && !isAdmin) ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <ShieldCheck size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
          <h2>Access Denied</h2>
          <p style={{ color: 'var(--text-muted)' }}>You do not have permission to view system activity logs.</p>
          <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => setView('dashboard')}>Return to Dashboard</button>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
            <h2 style={{ marginBottom: 0 }}>
              {view === 'invoice-history' ? 'Invoice History' : 'System Logs'}
            </h2>
            <button
              className={`btn btn-ghost ${loading ? 'animate-spin' : ''}`}
              onClick={async () => {
                setLoading(true);
                await fetchLogs();
                setLoading(false);
                logEvent('Refreshed Logs', 'Manual Update');
              }}
              disabled={loading}
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            {view === 'invoice-history' ? (
              /* Invoice History Table */
              <>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '1rem' }}>Date</th>
                    <th style={{ padding: '1rem' }}>Agency</th>
                    <th style={{ padding: '1rem' }}>Type</th>
                    <th style={{ padding: '1rem' }}>Amount</th>
                    <th style={{ padding: '1rem' }}>Invoice #</th>
                    <th style={{ padding: '1rem' }}>Processed By</th>
                    <th style={{ padding: '1rem' }}>Emailed?</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.filter(l => !l.invoiceType || l.invoiceType === 'Host' || l.invoiceType === 'CFP').map((log, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <td style={{ padding: '1rem' }}>{new Date(log.timestamp).toLocaleDateString()}</td>
                      <td style={{ padding: '1rem' }}>{log.agencyName}</td>
                      <td style={{ padding: '1rem' }}><span className={`badge ${log.invoiceType === 'CFP' ? 'badge-warning' : 'badge-success'}`}>{log.invoiceType || 'Host'}</span></td>
                      <td style={{ padding: '1rem' }}>${log.amount ? log.amount.toFixed(2) : '0.00'}</td>
                      <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{log.invoiceNumber || log.invoiceId}</td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{log.loggedInUser || 'System'}</td>
                      <td style={{ padding: '1rem' }}>
                        {log.emailSent ? <CheckCircle2 size={16} color="var(--success)" /> : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            ) : (
              /* System Logs Table */
              <>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '1rem' }}>Timestamp</th>
                    <th style={{ padding: '1rem' }}>Action</th>
                    <th style={{ padding: '1rem' }}>Details</th>
                    <th style={{ padding: '1rem' }}>User</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.filter(l => l.invoiceType !== 'Host' && l.invoiceType !== 'CFP').map((log, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <td style={{ padding: '1rem' }}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '4px',
                          background: 'rgba(99, 102, 241, 0.1)',
                          color: 'var(--primary)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          letterSpacing: '0.05em'
                        }}>
                          {log.status === log.details ? 'General' : log.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ color: 'white', fontWeight: 500, display: 'block' }}>
                          {log.status === log.details ? log.status : (log.details || '-')}
                        </span>
                        {log.agencyName && log.agencyName !== 'System' && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            Impacts: {log.agencyName}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>{log.loggedInUser || 'System'}</td>
                    </tr>
                  ))}
                  {logs.filter(l => l.invoiceType !== 'Host' && l.invoiceType !== 'CFP' && l.invoiceType).length === 0 && (
                    <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No system logs found.</td></tr>
                  )}
                </tbody>
              </>
            )}
          </table>
        </div>
      )
      }

      {
        showAddModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div className="glass-card" style={{ width: '500px', padding: '2rem' }}>
              <h2 style={{ marginBottom: '1.5rem' }}>Add New Host Agency</h2>
              <form onSubmit={handleAddAgency} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input type="text" placeholder="Agency ID" required value={newAgency.id} onChange={e => setNewAgency({ ...newAgency, id: e.target.value })} />
                <input type="text" placeholder="Agency Name" required value={newAgency.name} onChange={e => setNewAgency({ ...newAgency, name: e.target.value })} />
                <input type="email" placeholder="Billing Email" required value={newAgency.email} onChange={e => setNewAgency({ ...newAgency, email: e.target.value })} />
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Agency</button>
                  <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )
      }
      {
        showExclusionModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem' }}>Global Exclusions</h2>
                <button className="btn btn-ghost" onClick={() => setShowExclusionModal(false)}><X size={20} /></button>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ADD AGENCY BY ID</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Enter ID (e.g. 101)"
                    value={excludeIdInput}
                    onChange={e => setExcludeIdInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && excludeIdInput && (toggleExcludeId(excludeIdInput), setExcludeIdInput(''))}
                    style={{ flex: 1, border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', padding: '0.75rem' }}
                  />
                  <button className="btn btn-primary" onClick={() => {
                    if (excludeIdInput) {
                      toggleExcludeId(excludeIdInput);
                      setExcludeIdInput('');
                    }
                  }}>Add</button>
                </div>
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {excludedIds.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No agencies excluded yet.</p>
                ) : (
                  excludedIds.map(id => {
                    const agency = rawAgencies.find(a => String(a.id) === id) || rawCfpAgencies.find(a => String(a.id) === id);
                    return (
                      <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{agency ? agency.name : `Agency ID: ${id}`}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {id}</div>
                        </div>
                        <button className="btn btn-ghost" style={{ color: 'var(--error)' }} onClick={() => toggleExcludeId(id)}><X size={16} /></button>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )
      }
    </div >
  );
}

export default App;
