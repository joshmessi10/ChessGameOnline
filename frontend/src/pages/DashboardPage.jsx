import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/auth';
import { LuPlay, LuUsers, LuUser, LuSearch, LuTrophy, LuHistory, LuTrendingUp } from 'react-icons/lu';
import chessHero from '../components/chess.svg';

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div style={{
    backgroundColor: 'var(--surface-color)',
    border: '1px solid var(--border-color)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
    minWidth: '160px',
    zIndex: 10
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      <Icon size={14} /> {label}
    </div>
    <div style={{ fontSize: '28px', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
  </div>
);

const ActionCard = ({ to, icon: Icon, title, desc }) => (
  <Link to={to} style={{ 
    textDecoration: 'none', 
    backgroundColor: 'var(--surface-color)', 
    border: '1px solid var(--border-color)', 
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    transition: 'all 0.2s',
    zIndex: 10
  }}
  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; e.currentTarget.style.backgroundColor = '#121214'; }}
  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.backgroundColor = 'var(--surface-color)'; }}
  >
    <Icon size={24} style={{ color: 'var(--text-primary)' }} />
    <div>
      <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{desc}</div>
    </div>
  </Link>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api.get('/profile/me').then(r => setProfile(r.data)).catch(() => {});
  }, []);

  const stats = profile?.stats;
  const elo = profile?.userELO || 1200;
  
  return (
    <div className="fade-in" style={{ 
      minHeight: '100vh',
      background: 'radial-gradient(circle at 50% 30%, #1c1c1c 0%, #0c0b0a 70%)',
      padding: '4rem 2rem',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: '5rem', position: 'relative', zIndex: 10 }}>
        <h1 style={{ fontSize: '4.5rem', marginBottom: '1.5rem', maxWidth: '800px', margin: '0 auto 1.5rem auto' }}>
          Play Chess Online on the <span style={{ fontStyle: 'italic' }}>Elite</span> Site.
        </h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500, letterSpacing: '0.02em', marginBottom: '3rem' }}>
          <span><strong style={{ color: 'var(--text-primary)' }}>24,930</strong> Games Today</span>
          <span><strong style={{ color: 'var(--text-primary)' }}>1,042</strong> Playing Now</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <button 
            onClick={() => navigate('/play')}
            className="primary-btn" 
            style={{ padding: '16px 40px', fontSize: '15px' }}
          >
            Play Online
          </button>
          <button 
            onClick={() => navigate('/friends')}
            className="secondary-btn" 
            style={{ padding: '16px 40px', fontSize: '15px' }}
          >
            Challenge Friends
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'flex', gap: '1px', backgroundColor: 'var(--border-color)', marginBottom: '4rem', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative', zIndex: 10 }}>
        <StatCard label="Live Rating" value={elo} icon={LuTrendingUp} color="#f59e0b" />
        <StatCard label="Victories" value={stats?.victorias || 0} icon={LuTrophy} color="var(--success-color)" />
        <StatCard label="Total Matches" value={stats?.partidas_jugadas || 0} icon={LuHistory} />
        <StatCard label="Social Rank" value="Global" icon={LuUsers} />
      </div>

      {/* Action Grid */}
      <h2 style={{ position: 'relative', zIndex: 10, fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-secondary)', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem' }}>
        Grandmaster Tools
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', position: 'relative', zIndex: 10 }}>
        <ActionCard to="/play" icon={LuPlay} title="Standard Play" desc="Join the competitive ranked matchmaking queue." />
        <ActionCard to="/search" icon={LuSearch} title="Player Database" desc="Find opponents, study their games, and compare stats." />
        <ActionCard to="/friends" icon={LuUsers} title="Social Hub" desc="Manage your inner circle and pending invitations." />
        <ActionCard to="/profile/me" icon={LuUser} title="Legacy Profile" desc="Analyze your detailed history and progression." />
      </div>

      {/* Hero Graphic - Isometric Chessboard SVG (Absolute Background) */}
      <div style={{ 
        position: 'absolute',
        bottom: '-5%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%', 
        maxWidth: '1200px',
        opacity: 0.15,
        zIndex: 1,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}>
        <img src={chessHero} alt="" style={{ width: '100%', height: 'auto', transform: 'scale(1.1)' }} />
      </div>

      </div>
    </div>
  );
};

export default DashboardPage;
