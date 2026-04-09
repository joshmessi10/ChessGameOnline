import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LuLogIn, LuChevronRight } from 'react-icons/lu';
import chessHero from '../components/chess.svg';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login({ username, password });
      navigate('/');
    } catch (err) {
      setError('Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{
      minHeight: 'calc(100vh - 84px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: 'radial-gradient(circle at 50% 30%, #1c1c1c 0%, #0c0b0a 70%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Graphic */}
      <div style={{ 
        position: 'absolute',
        bottom: '2%',
        left: '50%',
        transform: 'translateX(-50%) scale(0.6)',
        width: '100%',
        maxWidth: '700px',
        opacity: 0.1,
        pointerEvents: 'none',
        zIndex: 1
      }}>
        <img src={chessHero} alt="Chess Graphic" style={{ width: '100%', height: 'auto' }} />
      </div>

      <div style={{
        width: '100%',
        maxWidth: '400px',
        zIndex: 10,
        backgroundColor: 'rgba(12, 11, 10, 0.8)',
        padding: '3rem',
        border: '1px solid var(--border-color)',
        backdropFilter: 'blur(10px)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem', fontFamily: 'Playfair Display, serif' }}>Login</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Professional Chess Platform
          </p>
        </div>

        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--error-color)',
            color: 'var(--error-color)',
            fontSize: '13px',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '11px', fontWeight: 600 }}>Identifier</label>
            <input
              type="text"
              placeholder="Username or Email"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              style={{ borderRadius: 0 }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '11px', fontWeight: 600 }}>Security Key</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ borderRadius: 0 }}
            />
          </div>

          <button
            type="submit"
            className="primary-btn"
            disabled={loading}
            style={{ width: '100%', height: '50px', borderRadius: 0 }}
          >
            {loading ? 'Authenticating...' : (
              <>
                Continue <LuChevronRight size={18} style={{ marginLeft: '4px' }} />
              </>
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '2.5rem', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--text-primary)', fontWeight: 700, textDecoration: 'underline' }}>
             Join ChessCamp
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
