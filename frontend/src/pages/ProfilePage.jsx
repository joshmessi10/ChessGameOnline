import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/auth';
import { LuTrophy, LuTrendingUp, LuHistory, LuUser, LuMapPin, LuCalendar, LuExternalLink } from 'react-icons/lu';

const ProfilePage = () => {
  const { userID, userId } = useParams();
  const resolvedId = userID || userId;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modeFilter, setModeFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [colorFilter, setColorFilter] = useState('all');

  const fetchProfile = async () => {
    try {
      const endpoint = resolvedId && resolvedId !== 'me' ? `/profile/${resolvedId}` : '/profile/me';
      const { data } = await api.get(endpoint);
      setProfile(data);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { fetchProfile(); }, [resolvedId]);

  if (loading) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
      Synchronizing profile data...
    </div>
  );
  
  if (!profile) return (
    <div style={{ padding: '4rem', textAlign: 'center' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Profile Not Found</h2>
      <Link to="/" className="secondary-btn">Return Home</Link>
    </div>
  );

  const stats = profile.stats || { victorias: 0, partidas_jugadas: 0, empates: 0 };
  const matches = profile.matchHistory || [];

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      const isVictory = m.result === (m.playerColor === 'white' ? 'white_win' : 'black_win');
      const normalizedResult = m.result === 'draw' ? 'draw' : (isVictory ? 'victory' : 'defeat');

      const byMode = modeFilter === 'all' || m.modo === modeFilter;
      const byResult = resultFilter === 'all' || normalizedResult === resultFilter;
      const byColor = colorFilter === 'all' || m.playerColor === colorFilter;
      return byMode && byResult && byColor;
    });
  }, [matches, modeFilter, resultFilter, colorFilter]);

  const eloSummary = useMemo(() => {
    return filteredMatches.reduce(
      (acc, m) => {
        if (typeof m.eloDelta !== 'number') return acc;
        acc.total += m.eloDelta;
        if (m.eloDelta > 0) acc.won += m.eloDelta;
        if (m.eloDelta < 0) acc.lost += m.eloDelta;
        return acc;
      },
      { total: 0, won: 0, lost: 0 },
    );
  }, [filteredMatches]);

  return (
    <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto', padding: '4rem 2rem' }}>
      
      {/* Profile Header */}
      <div style={{ 
        display: 'flex', gap: '3rem', alignItems: 'flex-start', 
        marginBottom: '5rem', borderBottom: '1px solid var(--border-color)', 
        paddingBottom: '3rem' 
      }}>
        <div style={{ 
          width: '120px', height: '120px', backgroundColor: 'var(--surface-color)', 
          border: '1px solid var(--border-color)', display: 'flex', 
          alignItems: 'center', justifyContent: 'center', fontSize: '48px', fontWeight: 800 
        }}>
          {profile.nombre_usuario?.[0]?.toUpperCase()}
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: '3.5rem', marginBottom: '0.2rem' }}>{profile.nombre_usuario}</h1>
                <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><LuMapPin size={14} /> {profile.pais || 'Global'}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><LuCalendar size={14} /> Joined {new Date().getFullYear()}</span>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { label: 'Bullet', val: profile.bulletELO || 1200 },
                { label: 'Blitz', val: profile.blitzELO || 1200 },
                { label: 'Rapid', val: profile.rapidELO || 1200 },
                { label: 'Classical', val: profile.classicalELO || 1200 },
              ].map((m, idx) => (
                <div key={idx} style={{ 
                  backgroundColor: 'var(--surface-color)', 
                  border: '1px solid var(--border-color)', 
                  padding: '12px', 
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px', letterSpacing: '0.05em' }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#f59e0b' }}>
                    {m.val}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Stats Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', backgroundColor: 'var(--border-color)', border: '1px solid var(--border-color)', marginBottom: '5rem' }}>
        {[
          { label: 'Win Rate', val: `${Math.round((stats.victorias / (stats.partidas_jugadas || 1)) * 100)}%`, icon: LuTrendingUp },
          { label: 'Victories', val: stats.victorias, icon: LuTrophy },
          { label: 'Draws', val: stats.empates, icon: LuHistory },
          { label: 'Total Games', val: stats.partidas_jugadas, icon: LuUser },
        ].map((s, i) => (
          <div key={i} style={{ backgroundColor: 'var(--bg-color)', padding: '2rem', textAlign: 'center' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
              <s.icon size={13} /> {s.label}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Match History */}
      <div>
        <h2 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-secondary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LuHistory size={16} /> Competition History
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))',
            gap: '12px',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ border: '1px solid var(--border-color)', padding: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Mode</div>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              style={{ width: '100%', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px' }}
            >
              <option value="all">All</option>
              <option value="bullet">Bullet</option>
              <option value="blitz">Blitz</option>
              <option value="rapid">Rapid</option>
              <option value="classical">Classical</option>
            </select>
          </div>

          <div style={{ border: '1px solid var(--border-color)', padding: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Result</div>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              style={{ width: '100%', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px' }}
            >
              <option value="all">All</option>
              <option value="victory">Victory</option>
              <option value="defeat">Defeat</option>
              <option value="draw">Draw</option>
            </select>
          </div>

          <div style={{ border: '1px solid var(--border-color)', padding: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Color</div>
            <select
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              style={{ width: '100%', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px' }}
            >
              <option value="all">All</option>
              <option value="white">White</option>
              <option value="black">Black</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', backgroundColor: 'var(--border-color)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>ELO Net</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: eloSummary.total >= 0 ? 'var(--success-color)' : 'var(--error-color)' }}>
              {eloSummary.total >= 0 ? `+${eloSummary.total}` : eloSummary.total}
            </div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>ELO Won</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--success-color)' }}>+{eloSummary.won}</div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>ELO Lost</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--error-color)' }}>{eloSummary.lost}</div>
          </div>
        </div>
        
        <div style={{ border: '1px solid var(--border-color)' }}>
          {filteredMatches.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>No match records found for this identifier.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredMatches.map(m => {
                const isWinner = m.result === (m.playerColor === 'white' ? 'white_win' : 'black_win');
                return (
                  <div key={m.matchID} style={{ 
                    padding: '1.25rem 2rem', borderBottom: '1px solid var(--border-color)', 
                    display: 'grid', gridTemplateColumns: '120px 1fr 120px 150px 100px', alignItems: 'center',
                    backgroundColor: isWinner ? 'rgba(34, 197, 94, 0.03)' : 'transparent'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: isWinner ? 'var(--success-color)' : (m.result === 'draw' ? '#f59e0b' : 'var(--error-color)') }}>
                      {isWinner ? 'Victory' : (m.result === 'draw' ? 'Draw' : 'Defeat')}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800 }}>vs. {m.opponentUsername}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{m.modo} • {m.playerColor}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '12px', fontWeight: 800, color: typeof m.eloDelta === 'number' ? (m.eloDelta >= 0 ? 'var(--success-color)' : 'var(--error-color)') : 'var(--text-secondary)' }}>
                      {typeof m.eloDelta === 'number'
                        ? (m.eloDelta >= 0 ? `+${m.eloDelta} ELO` : `${m.eloDelta} ELO`)
                        : 'ELO N/A'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                      {new Date(m.date).toLocaleDateString()}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Link to={`/match/${m.matchID}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', fontSize: '12px', fontWeight: 700 }}>
                        Details <LuExternalLink size={14} />
                      </Link>
                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default ProfilePage;
