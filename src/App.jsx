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
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PipelineView from './components/PipelineView';
import ConfigModal from './components/ConfigModal';
import { ProgressBar } from './components/ProgressBar';
import Login from './components/Login';
import SummaryView from './components/SummaryView';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [agencies, setAgencies] = useState([]);
  const [cfpAgencies, setCfpAgencies] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'pipeline', 'logs', 'cfp'
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfig, setShowConfig] = useState(null); // ID of agency being configured
  const [loadingProgress, setLoadingProgress] = useState({ visible: false, text: '', percentage: 0 });
  const [newAgency, setNewAgency] = useState({ id: '', name: '', email: '', userPrice: 15.0, segmentPrice: 0.05, sheetId: '1-DilrlkKOa9QJDBi87NhVv9LaXnY_dw0fHwjzfqmCyM' });

  const fetchData = async () => {
    setLoadingProgress({ visible: true, text: 'Fetching Agencies & Logs...', percentage: 0 });
    try {
      const [agencyRes, logsRes, cfpRes] = await Promise.all([
        fetch('/api/agencies'),
        fetch('/api/logs'),
        fetch('/api/cfp-agencies')
      ]);
      const agencyData = await agencyRes.json();
      const logsData = await logsRes.json();
      const cfpData = await cfpRes.json();

      setAgencies(agencyData);
      setLogs(logsData);
      setCfpAgencies(cfpData);
    } catch (err) {
      console.error(err);
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

  useEffect(() => {
    fetchData();
  }, []);

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
          agency={selectedAgency}
          segmentOnly={selectedAgency.isCFPMode}
          onBack={() => {
            setView(selectedAgency.isCFPMode ? 'cfp' : 'dashboard');
            fetchData();
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
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={40} /> HOST AGENCY BILLING
          </h4>
          <h1 style={{ fontSize: '2.5rem' }}>
            {view === 'dashboard' ? 'Host Agencies' : view === 'cfp' ? 'CFP Affiliate Sites' : 'Activity Logs'}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="glass-card" style={{ padding: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by Name or ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value) {
                  setLoadingProgress({ visible: true, text: `Searching for "${e.target.value}"...`, percentage: undefined });
                  setTimeout(() => setLoadingProgress({ visible: false, text: '', percentage: 0 }), 500);
                }
              }}
              style={{ border: 'none', background: 'transparent', width: '180px', color: 'white', outline: 'none' }}
            />
          </div>
          <button className={`btn ${view === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('dashboard')}>
            <Users size={18} /> Host Agencies
          </button>
          <button className={`btn ${view === 'cfp' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('cfp')}>
            <Database size={18} /> CFP
          </button>
          <button className={`btn ${view === 'logs' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('logs')}>
            <History size={18} /> Logs
          </button>
          <button className={`btn ${view === 'summary' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('summary')}>
            <LayoutDashboard size={18} /> Monthly Summary
          </button>

          {view === 'dashboard' && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={18} /> New
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </header>

      {view === 'summary' ? (
        <SummaryView agencies={filteredAgencies} />
      ) : view !== 'logs' ? (
        <div>
          {view === 'cfp' && (
            <div className="glass-card" style={{ padding: '1rem', marginBottom: '2rem', borderLeft: '4px solid var(--warning)' }}>
              <p style={{ fontSize: '0.9rem' }}>
                <strong>CFP Mode Active:</strong>
                Invoicing them will charge <strong> CFP Booking Fees only</strong>.
              </p>
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
                    style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: latestLog ? '4px solid var(--success)' : 'none' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                      <div>
                        <h3 style={{ fontSize: '1.25rem' }}>{agency.name}</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <code style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {agency.id}</code>
                          {agency.agreementType === 'Complex' && <span className="badge badge-warning" style={{ fontSize: '0.6rem' }}>COMPLEX</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'start' }}>
                        {view !== 'cfp' && (
                          <button className="btn btn-ghost" style={{ padding: '5px' }} onClick={() => setShowConfig(agency.id)}>
                            <Settings size={20} />
                          </button>
                        )}
                        {latestLog && latestLog.emailSent && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle2 size={12} /> SENT
                          </span>
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
      ) : (
        <div className="glass-card" style={{ padding: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '1rem' }}>Date</th>
                <th style={{ padding: '1rem' }}>Agency</th>
                <th style={{ padding: '1rem' }}>Type</th>
                <th style={{ padding: '1rem' }}>Amount</th>
                <th style={{ padding: '1rem' }}>Stripe ID</th>
                <th style={{ padding: '1rem' }}>Email</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <td style={{ padding: '1rem' }}>{new Date(log.timestamp).toLocaleDateString()}</td>
                  <td style={{ padding: '1rem' }}>{log.agencyName}</td>
                  <td style={{ padding: '1rem' }}><span className={`badge ${log.invoiceType === 'CFP' ? 'badge-warning' : 'badge-success'}`}>{log.invoiceType || 'Host'}</span></td>
                  <td style={{ padding: '1rem' }}>${log.amount.toFixed(2)}</td>
                  <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{log.invoiceId}</td>
                  <td style={{ padding: '1rem' }}>
                    {log.emailSent ? <CheckCircle2 size={16} color="var(--success)" /> : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
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
      )}
    </div>
  );
}

export default App;
