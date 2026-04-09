import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LuLogIn, LuChevronRight } from 'react-icons/lu';

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
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>Login</h1>
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
