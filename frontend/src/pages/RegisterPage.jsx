import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api/auth';
import { LuUserPlus, LuChevronRight } from 'react-icons/lu';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    nombre_usuario: '',
    correo: '',
    hash_contrasena: '',
    pais: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(formData);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const inputLabelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--text-secondary)',
    marginBottom: '8px'
  };

  return (
    <div className="fade-in" style={{
      minHeight: 'calc(100vh - 84px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>Account</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Joining the ChessCamp Community
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label style={inputLabelStyle}>Username</label>
              <input name="nombre_usuario" type="text" value={formData.nombre_usuario} onChange={handleChange} required placeholder="alex_grand" />
            </div>
            <div className="form-group">
              <label style={inputLabelStyle}>Country</label>
              <input name="pais" type="text" value={formData.pais} onChange={handleChange} placeholder="Optional" />
            </div>
          </div>
          
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={inputLabelStyle}>Email Address</label>
            <input name="correo" type="email" value={formData.correo} onChange={handleChange} required placeholder="alex@email.com" />
          </div>

          <div className="form-group" style={{ marginBottom: '2.5rem' }}>
            <label style={inputLabelStyle}>Security Password</label>
            <input name="hash_contrasena" type="password" value={formData.hash_contrasena} onChange={handleChange} required placeholder="••••••••" />
          </div>

          <button
            type="submit"
            className="primary-btn"
            disabled={loading}
            style={{ width: '100%', height: '50px' }}
          >
            {loading ? 'Creating Account...' : (
              <>
                Register <LuChevronRight size={18} />
              </>
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '2.5rem', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Already registered?{' '}
          <Link to="/login" style={{ color: 'var(--text-primary)', fontWeight: 700, textDecoration: 'underline' }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
