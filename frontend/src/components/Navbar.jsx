import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LuPlay, LuUsers, LuUser, LuLogOut, LuSearch } from 'react-icons/lu';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    padding: '8px 12px',
    transition: 'color 0.2s',
  };

  return (
    <nav style={{
      borderBottom: '1px solid var(--border-color)',
      padding: '1.5rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: 'var(--bg-color)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
    }}>
      {/* Brand Logo - Top Left */}
      <Link to="/" style={{ 
        fontFamily: 'Playfair Display, serif', 
        fontSize: '20px', 
        fontWeight: 800, 
        letterSpacing: '0.1em',
        color: 'var(--text-primary)'
      }}>
        CHESS<span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>CAMP</span>
      </Link>

      {/* Nav Items - Center/Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link to="/play" style={navLinkStyle}>
          <LuPlay size={16} /> Play
        </Link>
        <Link to="/friends" style={navLinkStyle}>
          <LuUsers size={16} /> Social
        </Link>
        <Link to="/search" style={navLinkStyle}>
          <LuSearch size={16} /> Search
        </Link>
        
        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)', margin: '0 8px' }} />

        {user ? (
          <>
            <Link to="/profile/me" style={navLinkStyle}>
              <LuUser size={16} /> {user.username}
            </Link>
            <button 
              onClick={handleLogout} 
              style={{
                backgroundColor: 'transparent',
                color: 'var(--error-color)',
                fontSize: '13px',
                fontWeight: 600,
                padding: '8px 12px',
                gap: '6px'
              }}
            >
              <LuLogOut size={16} /> Exit
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ ...navLinkStyle, color: 'var(--text-primary)' }}>Login</Link>
            <Link to="/register" className="primary-btn" style={{ marginLeft: '8px' }}>
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
