import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api/auth';
import { LuUserPlus, LuChevronRight } from 'react-icons/lu';
import chessHero from '../components/chess.svg';

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
      padding: '4rem 2rem',
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
        maxWidth: '480px',
        zIndex: 10,
        backgroundColor: 'rgba(12, 11, 10, 0.8)',
        padding: '3rem',
        border: '1px solid var(--border-color)',
        backdropFilter: 'blur(10px)'
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
            textAlign: 'center'
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label style={inputLabelStyle}>Username</label>
              <input 
                name="nombre_usuario" 
                type="text" 
                value={formData.nombre_usuario} 
                onChange={handleChange} 
                required 
                placeholder="grandmaster" 
                style={{ borderRadius: 0 }}
              />
            </div>
            <div className="form-group">
              <label style={inputLabelStyle}>Country</label>
              <input 
                name="pais" 
                type="text" 
                value={formData.pais} 
                onChange={handleChange} 
                placeholder="Global" 
                style={{ borderRadius: 0 }}
              />
            </div>
          </div>
          
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={inputLabelStyle}>Email Address</label>
            <input 
              name="correo" 
              type="email" 
              value={formData.correo} 
              onChange={handleChange} 
              required 
              placeholder="chess@elite.com" 
              style={{ borderRadius: 0 }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '2.5rem' }}>
            <label style={inputLabelStyle}>Security Password</label>
            <input 
              name="hash_contrasena" 
              type="password" 
              value={formData.hash_contrasena} 
              onChange={handleChange} 
              required 
              placeholder="••••••••" 
              style={{ borderRadius: 0 }}
            />
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
