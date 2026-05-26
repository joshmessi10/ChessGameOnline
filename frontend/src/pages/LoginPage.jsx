import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LuChevronRight } from 'react-icons/lu';
import chessHero from '../components/chess.svg';
import FieldError from '../components/FieldError';
import {
  validateLoginForm,
  validateLoginIdentifier,
  validatePassword,
} from '../utils/validation';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const validateField = (field, value) => {
    const message =
      field === 'username'
        ? validateLoginIdentifier(value)
        : validatePassword(value);
    setFieldErrors(prev => {
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
    return message;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errors = validateLoginForm({ username, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await login({ username: username.trim(), password });
      navigate('/dashboard');
    } catch {
      setError('Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputErrorStyle = (field) =>
    fieldErrors[field] ? { borderColor: 'var(--error-color)' } : {};

  return (
    <div className="fade-in" style={{
      minHeight: 'calc(100vh - 84px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: 'radial-gradient(circle at 50% 30%, #1c1c1c 0%, #0c0b0a 70%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        bottom: '2%',
        left: '50%',
        transform: 'translateX(-50%) scale(0.6)',
        width: '100%',
        maxWidth: '700px',
        opacity: 0.1,
        pointerEvents: 'none',
        zIndex: 1,
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
        backdropFilter: 'blur(10px)',
      }}>
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
            textAlign: 'center',
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="login-identifier"
              style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '11px', fontWeight: 600 }}
            >
              Identifier
            </label>
            <input
              id="login-identifier"
              type="text"
              placeholder="Username or Email"
              value={username}
              onChange={e => {
                setUsername(e.target.value);
                if (fieldErrors.username) validateField('username', e.target.value);
              }}
              onBlur={e => validateField('username', e.target.value)}
              autoComplete="username"
              maxLength={254}
              style={{ borderRadius: 0, ...inputErrorStyle('username') }}
              aria-invalid={!!fieldErrors.username}
            />
            <FieldError message={fieldErrors.username} />
          </div>
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label
              htmlFor="login-password"
              style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '11px', fontWeight: 600 }}
            >
              Security Key
            </label>
            <input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                if (fieldErrors.password) validateField('password', e.target.value);
              }}
              onBlur={e => validateField('password', e.target.value)}
              autoComplete="current-password"
              maxLength={128}
              style={{ borderRadius: 0, ...inputErrorStyle('password') }}
              aria-invalid={!!fieldErrors.password}
            />
            <FieldError message={fieldErrors.password} />
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
