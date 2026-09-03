import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Activity, 
  TrendingUp, 
  Clock, 
  Edit3, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw, 
  Play, 
  Square, 
  Info, 
  Sparkles, 
  Bot, 
  User,
  ArrowRight,
  ShieldCheck,
  Undo2,
  Download,
  BarChart2,
  X,
  Zap,
  Timer
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine,
  Cell
} from 'recharts';
import './App.css';

function App() {
  const [activeProfile, setActiveProfile] = useState('human'); // 'manual' | 'human' | 'bot'
  const [assertionFloor, setAssertionFloor] = useState(2.0); // seconds
  const [draftsQueue, setDraftsQueue] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState('2x'); // '1x' | '2x' | '5x' | 'instant'
  const [logs, setLogs] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState({
    conversionRate: 0,
    medianTimeToConvert: 0,
    editRate: 0,
    assertionPassed: true,
    totalProcessed: 0,
    convertedCount: 0,
    editedCount: 0,
    rejectedCount: 0
  });
  
  // Manual workspace state
  const [currentDraftIndex, setCurrentDraftIndex] = useState(0);
  const [editText, setEditText] = useState('');
  const [manualDraftStartTime, setManualDraftStartTime] = useState(null);
  const [manualElapsedTime, setManualElapsedTime] = useState(0);
  const [manualEditCount, setManualEditCount] = useState(0);

  // References for simulation timing
  const simTimeoutRef = useRef(null);
  const draftsQueueRef = useRef(draftsQueue);

  useEffect(() => {
    draftsQueueRef.current = draftsQueue;
  }, [draftsQueue]);

  // Live stopwatch timer for manual mode
  useEffect(() => {
    if (activeProfile !== 'manual' || currentDraftIndex >= draftsQueue.length || !manualDraftStartTime) {
      return;
    }

    const timerInterval = setInterval(() => {
      const elapsed = (Date.now() - manualDraftStartTime) / 1000;
      setManualElapsedTime(elapsed);
    }, 100);

    return () => clearInterval(timerInterval);
  }, [activeProfile, currentDraftIndex, draftsQueue.length, manualDraftStartTime]);

  const updateLocalState = useCallback((data) => {
    setActiveProfile(data.activeProfile);
    setAssertionFloor(data.assertionFloor);
    setDraftsQueue(data.draftsQueue);
    setHistoryData(data.historyData);
    setLogs(data.logs);
    setCurrentMetrics(data.metrics);

    // Find first pending draft index
    const nextPendingIndex = data.draftsQueue.findIndex(d => d.status === 'pending');
    if (nextPendingIndex !== -1) {
      setCurrentDraftIndex(nextPendingIndex);
      setEditText(data.draftsQueue[nextPendingIndex].content || data.draftsQueue[nextPendingIndex].originalText);
      setManualDraftStartTime(Date.now());
      setManualElapsedTime(0);
      setManualEditCount(0);
    } else {
      setCurrentDraftIndex(data.draftsQueue.length);
      setManualElapsedTime(0);
    }
  }, []);

  const initQueue = useCallback(async (mode = activeProfile) => {
    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: mode })
      });
      if (res.ok) {
        const data = await res.json();
        updateLocalState(data);
      }
    } catch (err) {
      console.error("Error resetting queue:", err);
    }
  }, [activeProfile, updateLocalState]);

  useEffect(() => {
    let active = true;
    async function loadInitial() {
      try {
        const res = await fetch('/api/state');
        if (res.ok && active) {
          const data = await res.json();
          updateLocalState(data);
        }
      } catch (err) {
        console.error("Error loading initial state:", err);
      }
    }
    loadInitial();
    return () => { active = false; };
  }, [updateLocalState]);

  const handleAssertionFloorChange = async (newFloor) => {
    setAssertionFloor(newFloor);
    try {
      const res = await fetch('/api/floor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ floor: newFloor })
      });
      if (res.ok) {
        const data = await res.json();
        updateLocalState(data);
      }
    } catch (err) {
      console.error("Error updating assertion floor:", err);
    }
  };

  // Handle manual typing
  const handleTextChange = (e) => {
    setEditText(e.target.value);
    setManualEditCount(prev => prev + 1);
  };

  // Preset quick edit actions
  const applyQuickEdit = (type) => {
    if (activeProfile !== 'manual') return;
    if (type === 'polish') {
      setEditText(prev => prev.trim() + " We appreciate your partnership and look forward to assisting you.");
      setManualEditCount(prev => prev + 1);
    } else if (type === 'signoff') {
      setEditText(prev => prev.trim() + "\n\nBest regards,\nCustomer Operations Support");
      setManualEditCount(prev => prev + 1);
    } else if (type === 'clear') {
      setEditText('');
      setManualEditCount(prev => prev + 1);
    }
  };

  // Convert/Accept active manual draft
  const handleManualAction = useCallback(async (status) => {
    const timeTaken = manualDraftStartTime ? (Date.now() - manualDraftStartTime) / 1000 : 1.0;
    const activeDraft = draftsQueue[currentDraftIndex];
    if (!activeDraft) return;

    const actionData = {
      draftId: activeDraft.id,
      status: status === 'accept' ? (manualEditCount > 0 ? 'edited' : 'converted') : 'rejected',
      content: editText,
      editCount: status === 'accept' ? manualEditCount : 0,
      timeToConvert: status === 'accept' ? Number(timeTaken.toFixed(2)) : null
    };

    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionData)
      });
      if (res.ok) {
        const data = await res.json();
        updateLocalState(data);
      }
    } catch (err) {
      console.error("Error committing manual action:", err);
    }
  }, [currentDraftIndex, draftsQueue, editText, manualDraftStartTime, manualEditCount, updateLocalState]);

  // Undo last action
  const handleUndo = useCallback(async () => {
    try {
      const res = await fetch('/api/action/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        updateLocalState(data);
      }
    } catch (err) {
      console.error("Error undoing action:", err);
    }
  }, [updateLocalState]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeProfile !== 'manual' || currentDraftIndex >= draftsQueue.length) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleManualAction('accept');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleManualAction('reject');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.altKey) {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeProfile, currentDraftIndex, draftsQueue.length, handleManualAction, handleUndo]);

  // Run automated simulation loops
  useEffect(() => {
    if (!isSimulating) {
      if (simTimeoutRef.current) clearTimeout(simTimeoutRef.current);
      return;
    }

    let isSubscribed = true;

    const runSimulationStep = async () => {
      try {
        const planRes = await fetch('/api/simulate/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile: activeProfile })
        });

        if (!planRes.ok) {
          if (isSubscribed) setIsSimulating(false);
          return;
        }

        const plan = await planRes.json();
        
        // Compute speed factor
        const speedMultiplier = simSpeed === '1x' ? 1.0 : simSpeed === '2x' ? 0.4 : simSpeed === '5x' ? 0.15 : 0.02;
        const totalSimTimeMs = (plan.readTime + plan.editTime) * 1000;
        const visualDelayMs = activeProfile === 'bot' 
          ? Math.max(totalSimTimeMs * speedMultiplier, 30) 
          : Math.max(Math.min(totalSimTimeMs * speedMultiplier, 1000), 50);

        if (!isSubscribed) return;

        simTimeoutRef.current = setTimeout(async () => {
          if (!isSubscribed) return;

          try {
            const originalDraft = draftsQueueRef.current[plan.draftIndex] || {};
            const content = plan.status === 'edited' 
              ? (originalDraft.originalText || '') + " [Simulated Human Polish]" 
              : (originalDraft.originalText || '');

            const actionRes = await fetch('/api/action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                draftId: plan.draftId,
                status: plan.status,
                content,
                editCount: plan.editCount,
                timeToConvert: plan.timeToConvert
              })
            });

            if (actionRes.ok) {
              const data = await actionRes.json();
              if (isSubscribed) {
                const nextPending = data.draftsQueue.findIndex(d => d.status === 'pending');
                updateLocalState(data);
                if (nextPending === -1) {
                  setIsSimulating(false);
                } else {
                  runSimulationStep();
                }
              }
            }
          } catch (err) {
            console.error("Error committing simulation action:", err);
            if (isSubscribed) setIsSimulating(false);
          }
        }, visualDelayMs);

      } catch (err) {
        console.error("Error getting simulation plan:", err);
        if (isSubscribed) setIsSimulating(false);
      }
    };

    runSimulationStep();

    return () => {
      isSubscribed = false;
      if (simTimeoutRef.current) clearTimeout(simTimeoutRef.current);
    };
  }, [isSimulating, activeProfile, simSpeed, updateLocalState]);

  const handleProfileChange = (profile) => {
    if (isSimulating) setIsSimulating(false);
    setActiveProfile(profile);
    initQueue(profile);
  };

  const handleStartStop = async () => {
    if (isSimulating) {
      setIsSimulating(false);
      try {
        const res = await fetch('/api/logs/append', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Simulation paused by user.', type: 'info' })
        });
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs);
        }
      } catch (err) {
        console.error("Error logging pause:", err);
      }
    } else {
      const nextPendingIndex = draftsQueue.findIndex(d => d.status === 'pending');
      if (nextPendingIndex === -1) {
        await initQueue();
      }
      setIsSimulating(true);
    }
  };

  // Export Session Data
  const exportSessionReport = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      activeProfile,
      assertionFloor,
      metrics: currentMetrics,
      drafts: draftsQueue,
      history: historyData
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metric-assertion-report-${activeProfile}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Dynamic YAxis Max so Assertion Floor is ALWAYS fully visible with clearance
  const chartMaxTime = Math.max(
    ...historyData.filter(d => d.timeToConvert !== null).map(d => d.timeToConvert),
    0
  );
  const yAxisUpperDomain = Math.max(
    Math.ceil(chartMaxTime * 1.25),
    Math.ceil(assertionFloor * 1.35),
    4
  );

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="brand-section">
            <div className="logo-wrapper">
              <Activity size={22} />
            </div>
            <div>
              <div className="brand-title">Metric Pair &amp; Assertion Guard</div>
              <div className="brand-subtitle">
                Draft Conversion Controls · Guarding Against False Positives
              </div>
            </div>
          </div>
          
          <div className="header-actions">
            <div className={`assertion-banner ${currentMetrics.assertionPassed ? 'passed' : 'failed'}`}>
              {currentMetrics.assertionPassed ? (
                <>
                  <ShieldCheck size={16} />
                  <span>ASSERTION PASSED · MEDIAN REVIEW &ge; {assertionFloor.toFixed(1)}s</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={16} />
                  <span>ASSERTION FAILED · MEDIAN ({currentMetrics.medianTimeToConvert}s) BELOW FLOOR</span>
                </>
              )}
            </div>

            <button 
              className="btn-header-action"
              onClick={() => setShowBenchmarkModal(true)}
              title="Compare Human vs Bot vs Current session"
            >
              <BarChart2 size={15} />
              <span>Benchmark Matrix</span>
            </button>

            <button 
              className="btn-header-action"
              onClick={exportSessionReport}
              title="Download session metrics in JSON format"
            >
              <Download size={15} />
              <span>Export</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <main className="dashboard-main">
        {/* Left Side Controls Panel */}
        <section className="controls-panel">
          {/* Profile Switcher Card */}
          <div className="card">
            <div className="card-title">
              <div className="card-title-left">
                <Sparkles size={16} />
                <span>Simulation Profile</span>
              </div>
            </div>

            <div className="sim-buttons-grid">
              <button 
                className={`btn-profile ${activeProfile === 'human' ? 'active' : ''}`}
                onClick={() => handleProfileChange('human')}
              >
                <div className="btn-profile-info">
                  <span className="btn-profile-name">
                    <User size={15} />
                    Thoughtful Reviewer
                  </span>
                  <span className="btn-profile-desc">Simulates real human reading &amp; editing</span>
                </div>
                <div className="btn-profile-icon" />
              </button>

              <button 
                className={`btn-profile ${activeProfile === 'bot' ? 'active bot-active' : ''}`}
                onClick={() => handleProfileChange('bot')}
              >
                <div className="btn-profile-info">
                  <span className="btn-profile-name">
                    <Bot size={15} />
                    Queue-Clearing Bot
                  </span>
                  <span className="btn-profile-desc">Rubber-stamps drafts immediately without reading</span>
                </div>
                <div className="btn-profile-icon" />
              </button>

              <button 
                className={`btn-profile ${activeProfile === 'manual' ? 'active' : ''}`}
                onClick={() => handleProfileChange('manual')}
              >
                <div className="btn-profile-info">
                  <span className="btn-profile-name">
                    <Edit3 size={15} />
                    Manual Workspace
                  </span>
                  <span className="btn-profile-desc">Review and convert queue items yourself</span>
                </div>
                <ArrowRight size={16} className="btn-profile-icon" />
              </button>
            </div>

            {/* Speed selection for automated profiles */}
            {activeProfile !== 'manual' && (
              <div className="speed-control-section">
                <div className="speed-control-label">
                  <span>Simulation Speed</span>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{simSpeed.toUpperCase()}</span>
                </div>
                <div className="speed-pill-group">
                  {['1x', '2x', '5x', 'instant'].map(speed => (
                    <button
                      key={speed}
                      className={`speed-pill ${simSpeed === speed ? 'active' : ''}`}
                      onClick={() => setSimSpeed(speed)}
                    >
                      {speed === 'instant' ? 'Instant' : speed}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="action-buttons">
              {activeProfile !== 'manual' ? (
                <button 
                  className={`btn-primary ${isSimulating ? 'running' : ''}`}
                  onClick={handleStartStop}
                >
                  {isSimulating ? (
                    <>
                      <Square size={15} />
                      <span>Stop Simulation</span>
                    </>
                  ) : (
                    <>
                      <Play size={15} />
                      <span>Start Simulation</span>
                    </>
                  )}
                </button>
              ) : null}
              <button 
                className="btn-secondary" 
                onClick={() => initQueue()}
                title="Reset drafts queue"
              >
                <RotateCcw size={15} />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Assertion Setup Card */}
          <div className="card">
            <div className="card-title">
              <div className="card-title-left">
                <Clock size={16} />
                <span>Assertion Floor Setup</span>
              </div>
            </div>
            
            <div className="setting-item">
              <label>
                Floor Threshold 
                <span className="setting-value">{assertionFloor.toFixed(1)}s</span>
              </label>
              <input 
                type="range" 
                min="0.5" 
                max="5.0" 
                step="0.5"
                value={assertionFloor} 
                onChange={(e) => handleAssertionFloorChange(Number(e.target.value))}
                className="slider-input"
              />
              <div className="preset-pills">
                {[1.0, 2.0, 3.0, 4.0].map(val => (
                  <button
                    key={val}
                    className={`preset-pill ${assertionFloor === val ? 'active' : ''}`}
                    onClick={() => handleAssertionFloorChange(val)}
                  >
                    {val.toFixed(1)}s
                  </button>
                ))}
              </div>
            </div>

            <p style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', lineHeight: '1.45' }}>
              Guards against false-positive conversion rates. An alert triggers if the median conversion time drops below this threshold.
            </p>
          </div>
        </section>

        {/* Right Side Metrics & Visualization Panels */}
        <section className="dashboard-content">
          {/* Top Row: Metrics Cards */}
          <div className="metrics-row">
            {/* Conversion Rate Card */}
            <div className={`card metric-card ${activeProfile === 'bot' ? 'success-border' : ''}`}>
              <div className="metric-label">
                <div className="metric-label-left">
                  <TrendingUp size={14} />
                  <span>Conversion Rate</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-secondary)' }}>Primary Metric</span>
              </div>
              <div className="metric-value" style={{ color: 'var(--color-secondary)' }}>
                {currentMetrics.conversionRate}%
              </div>
              <div className="metric-trend">
                Processed: {currentMetrics.convertedCount} / {currentMetrics.totalProcessed} drafts
              </div>
              {activeProfile === 'bot' && (
                <div className="trap-callout">
                  <strong>The Trap!</strong> Reporting rate alone is 100% for bot rubber-stamping, masking lack of review.
                </div>
              )}
            </div>

            {/* Median Time-to-Convert Card */}
            <div className={`card metric-card ${!currentMetrics.assertionPassed ? 'alert-border' : 'success-border'}`}>
              <div className="metric-label">
                <div className="metric-label-left">
                  <Clock size={14} />
                  <span>Median Review Time</span>
                </div>
                <span style={{ 
                  fontSize: '0.7rem', 
                  color: currentMetrics.assertionPassed ? 'var(--color-success)' : 'var(--color-error)',
                  fontWeight: 700 
                }}>
                  {currentMetrics.assertionPassed ? 'PASS' : 'FAIL'}
                </span>
              </div>
              <div className="metric-value" style={{ color: currentMetrics.assertionPassed ? 'var(--color-success)' : 'var(--color-error)' }}>
                {currentMetrics.medianTimeToConvert}s
              </div>
              <div className="metric-trend">
                Target Threshold Floor: &ge; {assertionFloor.toFixed(1)}s
              </div>
              
              <div className="floor-indicator-bar">
                <div 
                  className="floor-progress"
                  style={{
                    width: `${Math.min((currentMetrics.medianTimeToConvert / (assertionFloor * 2 || 4)) * 100, 100)}%`,
                    backgroundColor: currentMetrics.assertionPassed ? 'var(--color-success)' : 'var(--color-error)'
                  }}
                />
                <div 
                  className="floor-marker"
                  style={{ left: '50%' }}
                  title={`Floor Threshold: ${assertionFloor}s`}
                />
              </div>
            </div>

            {/* Edit Rate Card */}
            <div className="card metric-card">
              <div className="metric-label">
                <div className="metric-label-left">
                  <Edit3 size={14} />
                  <span>Edit Rate</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)' }}>Quality Guard</span>
              </div>
              <div className="metric-value" style={{ color: '#a5b4fc' }}>
                {currentMetrics.editRate}%
              </div>
              <div className="metric-trend">
                Modified: {currentMetrics.editedCount} / {currentMetrics.convertedCount} accepted drafts
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                Measures the percentage of converted drafts that received deliberate edits before sending.
              </p>
            </div>
          </div>

          {/* Middle Row: Live Interactive Workspace & Charts */}
          <div className="workspace-grid">
            {/* Live Chart Container */}
            <div className="card chart-card">
              <div className="card-title">
                <div className="card-title-left">
                  <Activity size={16} />
                  <span>Session Timeline &amp; Floor Assertion</span>
                </div>
                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>
                  {historyData.filter(d => d.timeToConvert !== null).length} data points
                </span>
              </div>

              <div className="chart-container">
                {historyData.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    Process drafts to populate the assertion timeline.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 25, bottom: 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis 
                        type="number" 
                        dataKey="index" 
                        name="Draft Order" 
                        stroke="var(--color-text-secondary)"
                        domain={[1, Math.max(draftsQueue.length, historyData.length)]}
                        tickCount={draftsQueue.length}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="timeToConvert" 
                        name="Seconds" 
                        stroke="var(--color-text-secondary)"
                        domain={[0, yAxisUpperDomain]}
                        label={{ value: 'Review Time (s)', angle: -90, position: 'insideLeft', fill: 'var(--color-text-secondary)', style: { textAnchor: 'middle', fontSize: 11 } }}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }} 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const isAbove = data.timeToConvert >= assertionFloor;
                            return (
                              <div style={{ backgroundColor: '#0f1420', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: '#f3f4f6', fontSize: '0.75rem' }}>
                                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Draft #{data.index} ({data.status})</div>
                                <div>Time: <strong style={{ color: isAbove ? 'var(--color-success)' : 'var(--color-error)' }}>{data.timeToConvert}s</strong></div>
                                <div>Threshold Floor: {assertionFloor}s</div>
                                <div>Assertion: <strong style={{ color: isAbove ? 'var(--color-success)' : 'var(--color-error)' }}>{isAbove ? 'PASSED' : 'BELOW FLOOR'}</strong></div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine 
                        y={assertionFloor} 
                        stroke="var(--color-error)" 
                        strokeDasharray="4 4" 
                        strokeWidth={2}
                        label={{ value: `Assertion Floor (${assertionFloor}s)`, fill: '#f87171', position: 'top', fontSize: 11 }} 
                      />
                      <Scatter 
                        name="Drafts" 
                        data={historyData.filter(d => d.timeToConvert !== null)} 
                      >
                        {
                          historyData.filter(d => d.timeToConvert !== null).map((entry, idx) => (
                            <Cell 
                              key={`cell-${idx}`} 
                              fill={entry.timeToConvert >= assertionFloor ? '#10b981' : '#ef4444'} 
                            />
                          ))
                        }
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Custom Chart Legend */}
              <div className="custom-chart-legend">
                <div className="legend-item">
                  <div className="legend-dot" style={{ backgroundColor: '#10b981' }} />
                  <span>Passed Floor (&ge; {assertionFloor.toFixed(1)}s)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-dot" style={{ backgroundColor: '#ef4444' }} />
                  <span>Below Floor (&lt; {assertionFloor.toFixed(1)}s)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line" />
                  <span>Floor Threshold Line</span>
                </div>
              </div>
            </div>

            {/* Active Draft Review Workspace */}
            <div className="card workspace-card">
              <div className="workspace-status">
                <div className="queue-badge-group">
                  <span>DRAFT REVIEW ({activeProfile.toUpperCase()})</span>
                  <span className="queue-counter">
                    {currentDraftIndex < draftsQueue.length 
                      ? `#${currentDraftIndex + 1} of ${draftsQueue.length}` 
                      : 'Done'}
                  </span>
                </div>

                {activeProfile === 'manual' && currentDraftIndex < draftsQueue.length && (
                  <div className="stopwatch-badge ticking">
                    <Timer size={13} />
                    <span>{manualElapsedTime.toFixed(1)}s elapsed</span>
                  </div>
                )}
              </div>

              {currentDraftIndex < draftsQueue.length ? (
                <div className="editor-area">
                  <div className="draft-header-meta">
                    <div className="draft-prompt">
                      Original Draft Suggestion
                    </div>
                    <div className="editor-stats">
                      {editText.length} chars · {editText.trim() ? editText.trim().split(/\s+/).length : 0} words
                    </div>
                  </div>

                  <div className="draft-content-container">
                    <textarea 
                      className="draft-textarea"
                      value={editText}
                      onChange={handleTextChange}
                      disabled={activeProfile !== 'manual'}
                      placeholder="Start reviewing/editing the draft..."
                    />

                    {isSimulating && (
                      <div className="simulated-activity-overlay">
                        <div className={`spinner ${activeProfile === 'bot' ? 'bot' : ''}`} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {activeProfile === 'human' 
                            ? 'Simulating Reviewer reading & typing...' 
                            : 'Bot auto-accepting in queue-clearing pattern...'}
                        </span>
                      </div>
                    )}
                  </div>

                  {activeProfile === 'manual' && (
                    <>
                      <div className="quick-tools-row">
                        <button className="quick-tool-btn" onClick={() => applyQuickEdit('polish')}>
                          + Add Polish
                        </button>
                        <button className="quick-tool-btn" onClick={() => applyQuickEdit('signoff')}>
                          + Standard Sign-off
                        </button>
                        <button className="quick-tool-btn" onClick={() => applyQuickEdit('clear')}>
                          Clear Text
                        </button>
                      </div>

                      <div className="editor-actions">
                        <button 
                          className="btn-editor-accept" 
                          onClick={() => handleManualAction('accept')}
                        >
                          <CheckCircle2 size={15} />
                          <span>Accept &amp; Convert ({manualElapsedTime.toFixed(1)}s)</span>
                        </button>
                        <button 
                          className="btn-editor-reject" 
                          onClick={() => handleManualAction('reject')}
                        >
                          Reject
                        </button>
                        <button 
                          className="btn-editor-undo" 
                          onClick={handleUndo}
                          disabled={historyData.length === 0}
                          title="Undo last processed draft"
                        >
                          <Undo2 size={16} />
                        </button>
                      </div>

                      <div className="shortcut-hints">
                        Shortcuts: <kbd>Ctrl+Enter</kbd> Accept · <kbd>Esc</kbd> Reject · <kbd>Alt+Ctrl+Z</kbd> Undo
                      </div>
                    </>
                  )}

                  {activeProfile !== 'manual' && !isSimulating && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
                      Click 'Start Simulation' above to run the auto-simulation.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)' }}>
                  <CheckCircle2 size={40} style={{ color: 'var(--color-success)' }} />
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' }}>Queue Cleared!</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: '280px' }}>
                    All drafts processed. Check the metrics assertion outcome or switch profiles.
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button className="btn-secondary" onClick={handleUndo} disabled={historyData.length === 0}>
                      <Undo2 size={14} />
                      <span>Undo Last</span>
                    </button>
                    <button className="btn-primary" onClick={() => initQueue()}>
                      <RotateCcw size={14} />
                      <span>Restart Queue</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row: Logs Card */}
          <div className="card logs-card">
            <div className="logs-header">
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Action &amp; Audit Logs ({logs.length})
              </span>
              <div className="logs-actions">
                <button 
                  className="btn-log-action"
                  onClick={() => setLogs([])}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="logs-container">
              {logs.length === 0 ? (
                <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.75rem' }}>
                  No event records.
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="log-entry">
                    <span className="log-time">[{log.timestamp}]</span>
                    <span className={`log-msg ${log.type}`}>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Benchmark Matrix Modal */}
      {showBenchmarkModal && (
        <div className="modal-backdrop" onClick={() => setShowBenchmarkModal(false)}>
          <div className="benchmark-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart2 size={18} color="var(--color-primary)" />
                <h3>Profile Benchmark Matrix</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowBenchmarkModal(false)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Comparing behavior profiles against the Assertion Floor ({assertionFloor.toFixed(1)}s) to demonstrate false-positive prevention:
            </p>

            <table className="benchmark-table">
              <thead>
                <tr>
                  <th>Profile</th>
                  <th>Conversion Rate</th>
                  <th>Median Review Time</th>
                  <th>Edit Rate</th>
                  <th>Assertion Guard Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Thoughtful Reviewer</strong> (Human)</td>
                  <td style={{ color: 'var(--color-secondary)' }}>85% – 95%</td>
                  <td style={{ color: 'var(--color-success)' }}>3.5s – 6.0s</td>
                  <td>~40%</td>
                  <td><span style={{ color: 'var(--color-success)', fontWeight: 700 }}>PASSED (Genuine Review)</span></td>
                </tr>
                <tr>
                  <td><strong>Queue-Clearing Bot</strong> (Rubber-stamp)</td>
                  <td style={{ color: 'var(--color-secondary)' }}>100% (Trap!)</td>
                  <td style={{ color: 'var(--color-error)' }}>0.05s – 0.15s</td>
                  <td>0%</td>
                  <td><span style={{ color: 'var(--color-error)', fontWeight: 700 }}>FAILED (Alert Triggered!)</span></td>
                </tr>
                <tr>
                  <td><strong>Current Active Session</strong></td>
                  <td style={{ color: 'var(--color-secondary)' }}>{currentMetrics.conversionRate}%</td>
                  <td style={{ color: currentMetrics.assertionPassed ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {currentMetrics.medianTimeToConvert}s
                  </td>
                  <td>{currentMetrics.editRate}%</td>
                  <td>
                    <span style={{ color: currentMetrics.assertionPassed ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 700 }}>
                      {currentMetrics.assertionPassed ? 'PASSED' : 'FAILED'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="info-banner" style={{ marginTop: '0.5rem' }}>
              <Zap size={18} />
              <div>
                <h4>Key Operational Takeaway</h4>
                <p>
                  A conversion rate of 100% without an assertion floor is a dangerous vulnerability in AI copilots. 
                  By pairing conversion rate with median time-to-convert, product teams prevent automated rubber-stamping 
                  and ensure meaningful human-in-the-loop engagement.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer / Educational Section */}
      <footer className="footer-info">
        <div className="info-banner">
          <Info />
          <div>
            <h4>Goodhart's Law in AI Workflows: Why Conversion Rate Alone is a Deceptive Metric</h4>
            <p>
              When a measure becomes a target, it ceases to be a good measure. In AI draft generation, 
              optimizing solely for conversion rate incentivizes automated rubber-stamping by bots or rushed agents. 
              By pairing conversion rate with <strong>median time-to-convert</strong> and asserting a minimum threshold 
              floor (e.g. {assertionFloor.toFixed(1)}s), the system detects superficial approvals and guarantees true cognitive review.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
