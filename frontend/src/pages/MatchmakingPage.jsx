import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/auth';
import { LuZap, LuFlame, LuClock, LuCrown, LuLoader, LuX } from 'react-icons/lu';

const ModeCard = ({ m, active, onClick }) => (
  <button
    id={`mode-${m.key}`}
    onClick={() => onClick(m.key)}
    style={{
      backgroundColor: active ? '#18181b' : 'var(--surface-color)',
      border: active ? '1px solid var(--text-primary)' : '1px solid var(--border-color)',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      textAlign: 'left',
      transition: 'all 0.2s',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <m.icon size={28} style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
    <div>
      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>{m.label}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{m.time} • {m.desc}</div>
    </div>
    {active && (
      <div style={{ position: 'absolute', top: 0, right: 0, padding: '4px 10px', backgroundColor: 'var(--text-primary)', color: '#000', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>Selected</div>
    )}
  </button>
);

const MatchmakingPage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null);
  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const pollRef = useRef(null);

  const modes = [
    { key: 'bullet', label: 'Bullet', time: '1+0', icon: LuZap, desc: 'Precision under pressure.' },
    { key: 'blitz', label: 'Blitz', time: '3+2', icon: LuFlame, desc: 'The modern standard.' },
    { key: 'rapid', label: 'Rapid', time: '10+0', icon: LuClock, desc: 'Deep strategic analysis.' },
    { key: 'classical', label: 'Classical', time: '30+0', icon: LuCrown, desc: 'Masters of the long game.' },
  ];

  useEffect(() => {
    if (searching) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await api.get('/matchmaking/status');
          if (data.matchID) {
            stopSearch();
            navigate(`/play/${data.matchID}`);
          }
        } catch {}
      }, 3000);
    }
    return () => stopLocal();
  }, [searching]);

  const stopLocal = () => {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
  };

  const startSearch = async () => {
    if (!mode) return;
    try {
      await api.post('/matchmaking/join', { modo: mode });
      setElapsed(0);
      setSearching(true);
    } catch {
      alert('Network error. Check connection.');
    }
  };

  const stopSearch = async () => {
    stopLocal();
    setSearching(false);
    try { await api.delete('/matchmaking/leave'); } catch {}
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (searching) {
    return (
      <div className="fade-in" style={{ minHeight: 'calc(100vh - 84px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ width: '80px', height: '80px', margin: '0 auto 2.5rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
            <LuLoader size={32} className="spin" />
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
          
          <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Searching</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '2.5rem' }}>
            Looking for a match in <strong>{mode.toUpperCase()}</strong> pool • {formatTime(elapsed)} elapsed
          </p>

          <button onClick={stopSearch} className="secondary-btn" style={{ width: '100%', height: '50px', gap: '8px' }}>
            <LuX size={18} /> Abort Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: '900px', margin: '0 auto', padding: '4rem 2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>Play Chess</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Choose a discipline and test your prowess against global masters.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {modes.map(m => (
          <ModeCard key={m.key} m={m} active={mode === m.key} onClick={setMode} />
        ))}
      </div>

      <button
        onClick={startSearch}
        disabled={!mode}
        className="primary-btn"
        style={{ width: '100%', height: '60px', fontSize: '16px', borderRadius: 0 }}
      >
        {mode ? `Initiate Matchmaking: ${mode.toUpperCase()}` : 'Select a Category'}
      </button>
      
      <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '12px', letterSpacing: '0.02em' }}>
        Matches are organized according to your global Ranking points.
      </p>
    </div>
  );
};

export default MatchmakingPage;
