import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/auth';
import { LuPlay, LuUsers, LuUser, LuLogOut, LuSearch, LuTrendingUp, LuSettings } from 'react-icons/lu';

const Navbar = () => {
  const { 
    user, logout, 
    incomingInvites, activeInviteNotification, setActiveInviteNotification 
  } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAcceptInvite = async (invite) => {
    try {
      await api.put(`/match/invite/${invite.id}/accept`);
      setActiveInviteNotification(null);
      navigate(`/play/${invite.id}`);
    } catch {
      alert("Failed to accept challenge.");
    }
  };

  const handleDeclineInvite = async (invite) => {
    try {
      await api.delete(`/match/invite/${invite.id}/decline`);
      setActiveInviteNotification(null);
    } catch {
      alert("Failed to decline challenge.");
    }
  };

  const navLinkStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    padding: '8px 12px',
    textDecoration: 'none',
    transition: 'color 0.2s',
  };

  return (
    <nav style={{
      padding: '1.5rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: 'var(--bg-color)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      borderBottom: '1px solid var(--border-color)'
    }}>
      {/* Brand Logo - Top Left */}
      <Link to={user ? "/dashboard" : "/"} style={{ 
        fontFamily: 'Playfair Display, serif', 
        fontSize: '20px', 
        fontWeight: 800, 
        letterSpacing: '0.1em',
        color: 'var(--text-primary)',
        textDecoration: 'none'
      }}>
        CHESS<span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>CAMP</span>
      </Link>

      {/* Nav Items - Center/Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link to="/play" style={navLinkStyle}>
          <LuPlay size={16} /> Play
        </Link>
        {user && (
          <Link to="/dashboard" style={navLinkStyle}>
            <LuTrendingUp size={16} /> Dashboard
          </Link>
        )}
        <Link to="/friends" style={navLinkStyle}>
          <LuUsers size={16} /> Social
          {user && incomingInvites && incomingInvites.length > 0 && (
            <span style={{ 
              backgroundColor: '#f59e0b', 
              color: '#000', 
              borderRadius: '50%', 
              padding: '2px 6px', 
              fontSize: '10px', 
              fontWeight: 800, 
              marginLeft: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1
            }}>
              {incomingInvites.length}
            </span>
          )}
        </Link>
        <Link to="/search" style={navLinkStyle}>
          <LuSearch size={16} /> Search
        </Link>
        
        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)', margin: '0 8px' }} />

        {user ? (
          <>
            <Link to="/profile/me" style={navLinkStyle}>
              <LuUser size={16} /> {user.nombre_usuario || user.username}
            </Link>
            <Link to="/settings" style={navLinkStyle} title="Settings">
              <LuSettings size={16} /> Settings
            </Link>

            <button 
              onClick={handleLogout} 
              style={{
                backgroundColor: 'transparent',
                color: 'var(--error-color)',
                fontSize: '13px',
                fontWeight: 600,
                padding: '8px 12px',
                gap: '6px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <LuLogOut size={16} /> Exit
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ ...navLinkStyle, color: 'var(--text-primary)' }}>Login</Link>
            <Link to="/register" className="primary-btn" style={{ marginLeft: '8px', textDecoration: 'none' }}>
              Sign Up
            </Link>
          </>
        )}
      </div>

      {/* Non-invasive Challenge Popup */}
      {user && activeInviteNotification && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          width: '320px',
          backgroundColor: '#121214',
          border: '1px solid var(--border-color)',
          padding: '1.5rem',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
          zIndex: 10000,
          animation: 'slideIn 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <style>{`
            @keyframes slideIn {
              from { transform: translateX(120%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `}</style>

          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#f59e0b', letterSpacing: '0.1em' }}>
            New Challenge
          </div>
          
          <div style={{ fontSize: '14px', lineHeight: 1.4, color: 'var(--text-primary)' }}>
            <strong>{activeInviteNotification.inviter_username}</strong> ({activeInviteNotification.inviter_elo}) has challenged you to a <strong>{activeInviteNotification.modo}</strong> match (<strong>{activeInviteNotification.control_tiempo}</strong>).
          </div>
          
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button 
              onClick={() => handleAcceptInvite(activeInviteNotification)} 
              className="primary-btn" 
              style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 700 }}
            >
              Accept
            </button>
            <button 
              onClick={() => handleDeclineInvite(activeInviteNotification)} 
              className="secondary-btn" 
              style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 700 }}
            >
              Decline
            </button>
          </div>
          
          <button 
            onClick={() => setActiveInviteNotification(null)}
            style={{
              position: 'absolute',
              top: '8px',
              right: '12px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: 400
            }}
          >
            ×
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
