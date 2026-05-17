import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/auth';
import { LuTrophy, LuTrendingUp, LuHistory, LuUser, LuMapPin, LuCalendar, LuExternalLink } from 'react-icons/lu';

const ProfilePage = () => {
  const { userID, userId } = useParams();
  const resolvedId = userID || userId;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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
        
        <div style={{ border: '1px solid var(--border-color)' }}>
          {matches.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>No match records found for this identifier.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {matches.map(m => {
                const isWinner = m.result === (m.playerColor === 'white' ? 'white_win' : 'black_win');
                return (
                  <div key={m.matchID} style={{ 
                    padding: '1.25rem 2rem', borderBottom: '1px solid var(--border-color)', 
                    display: 'grid', gridTemplateColumns: '120px 1fr 150px 100px', alignItems: 'center',
                    backgroundColor: isWinner ? 'rgba(34, 197, 94, 0.03)' : 'transparent'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: isWinner ? 'var(--success-color)' : (m.result === 'draw' ? '#f59e0b' : 'var(--error-color)') }}>
                      {isWinner ? 'Victory' : (m.result === 'draw' ? 'Draw' : 'Defeat')}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800 }}>vs. {m.opponentUsername}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{m.modo} • {m.playerColor}</div>
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
