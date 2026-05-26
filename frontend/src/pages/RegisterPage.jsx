import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api/auth';
import { LuChevronRight } from 'react-icons/lu';
import chessHero from '../components/chess.svg';
import FieldError from '../components/FieldError';
import {
  validateRegisterForm,
  validateUsername,
  validateEmail,
  validatePassword,
  validateCountry,
  PASSWORD_MIN_LENGTH,
} from '../utils/validation';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    nombre_usuario: '',
    correo: '',
    hash_contrasena: '',
    pais: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validateField = (name, value) => {
    let message = null;
    switch (name) {
      case 'nombre_usuario':
        message = validateUsername(value);
        break;
      case 'correo':
        message = validateEmail(value);
        break;
      case 'hash_contrasena':
        message = validatePassword(value, { forRegister: true });
        break;
      case 'pais':
        message = validateCountry(value);
        break;
      default:
        break;
    }
    setFieldErrors(prev => {
      const next = { ...prev };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
    return message;
  };

  const handleBlur = (e) => {
    validateField(e.target.name, e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errors = validateRegisterForm(formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await register({
        nombre_usuario: formData.nombre_usuario.trim(),
        correo: formData.correo.trim(),
        hash_contrasena: formData.hash_contrasena,
        pais: formData.pais.trim() || null,
      });
      navigate('/login');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map(d => d.msg || d).join(' ')
            : 'Registration failed. Try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (fieldErrors[name]) validateField(name, value);
  };

  const inputLabelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--text-secondary)',
    marginBottom: '8px',
  };

  const inputErrorStyle = (field) =>
    fieldErrors[field] ? { borderColor: 'var(--error-color)' } : {};

  return (
    <div className="fade-in" style={{
      minHeight: 'calc(100vh - 84px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem 2rem',
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
        maxWidth: '480px',
        zIndex: 10,
        backgroundColor: 'rgba(12, 11, 10, 0.8)',
        padding: '3rem',
        border: '1px solid var(--border-color)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem', fontFamily: 'Playfair Display, serif' }}>Register</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Joining the Elite ChessCamp Community
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label style={inputLabelStyle} htmlFor="nombre_usuario">Username</label>
              <input
                id="nombre_usuario"
                name="nombre_usuario"
                type="text"
                value={formData.nombre_usuario}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="username"
                maxLength={20}
                placeholder="grandmaster"
                style={{ borderRadius: 0, ...inputErrorStyle('nombre_usuario') }}
                aria-invalid={!!fieldErrors.nombre_usuario}
              />
              <FieldError message={fieldErrors.nombre_usuario} />
            </div>
            <div className="form-group">
              <label style={inputLabelStyle} htmlFor="pais">Country</label>
              <input
                id="pais"
                name="pais"
                type="text"
                value={formData.pais}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="country-name"
                maxLength={50}
                placeholder="Global"
                style={{ borderRadius: 0, ...inputErrorStyle('pais') }}
                aria-invalid={!!fieldErrors.pais}
              />
              <FieldError message={fieldErrors.pais} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={inputLabelStyle} htmlFor="correo">Email Address</label>
            <input
              id="correo"
              name="correo"
              type="email"
              value={formData.correo}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="email"
              maxLength={254}
              placeholder="chess@elite.com"
              style={{ borderRadius: 0, ...inputErrorStyle('correo') }}
              aria-invalid={!!fieldErrors.correo}
            />
            <FieldError message={fieldErrors.correo} />
          </div>

          <div className="form-group" style={{ marginBottom: '2.5rem' }}>
            <label style={inputLabelStyle} htmlFor="hash_contrasena">Security Password</label>
            <input
              id="hash_contrasena"
              name="hash_contrasena"
              type="password"
              value={formData.hash_contrasena}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={128}
              placeholder="••••••••"
              style={{ borderRadius: 0, ...inputErrorStyle('hash_contrasena') }}
              aria-invalid={!!fieldErrors.hash_contrasena}
            />
            <FieldError message={fieldErrors.hash_contrasena} />
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
              At least {PASSWORD_MIN_LENGTH} characters, with one letter and one number.
            </p>
          </div>

          <button
            type="submit"
            className="primary-btn"
            disabled={loading}
            style={{ width: '100%', height: '50px', borderRadius: 0 }}
          >
            {loading ? 'Processing...' : (
              <>
                Initialize Access <LuChevronRight size={18} />
              </>
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '2.5rem', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Already a member?{' '}
          <Link to="/login" style={{ color: 'var(--text-primary)', fontWeight: 700, textDecoration: 'underline' }}>
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
