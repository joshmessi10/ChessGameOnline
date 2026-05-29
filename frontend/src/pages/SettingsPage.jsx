import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { LuUser, LuMail, LuImage, LuGlobe, LuSettings, LuCheck } from 'react-icons/lu';
import FieldError from '../components/FieldError';
import {
  validateSettingsForm,
  validateUsername,
  validateEmail,
  validateAvatarUrl,
  validateCountry,
} from '../utils/validation';

const SettingsPage = () => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nombre_usuario: '',
    correo: '',
    url_avatar: '',
    pais: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get(`/settings/${user.id}`)
      .then(res => {
        setFormData({
          nombre_usuario: res.data.nombre_usuario || '',
          correo: res.data.correo || '',
          url_avatar: res.data.url_avatar || '',
          pais: res.data.pais || '',
        });
      })
      .catch(() => {
        setError('Failed to fetch user configurations.');
      });
  }, [user]);

  const validateField = (name, value) => {
    let message = null;
    switch (name) {
      case 'nombre_usuario':
        message = validateUsername(value);
        break;
      case 'correo':
        message = validateEmail(value);
        break;
      case 'url_avatar':
        message = validateAvatarUrl(value);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const errors = validateSettingsForm(formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        nombre_usuario: formData.nombre_usuario.trim(),
        correo: formData.correo.trim(),
        url_avatar: formData.url_avatar.trim() || null,
        pais: formData.pais.trim() || null,
      };
      const res = await api.put(`/settings/${user.id}`, payload);
      if (user.nombre_usuario !== res.data.nombre_usuario) {
        setSuccess('Username updated successfully. Please log in again with your new username.');
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 3000);
      } else {
        updateUser(res.data);
        setSuccess('Settings updated successfully!');
        setTimeout(() => setSuccess(''), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to persist configurations.');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) validateField(name, value);
  };

  const inputStyle = (field) => ({
    backgroundColor: 'var(--bg-color)',
    border: '1px solid var(--border-color)',
    padding: '1rem',
    color: 'var(--text-primary)',
    fontSize: '14px',
    ...(fieldErrors[field] ? { borderColor: 'var(--error-color)' } : {}),
  });

  return (
    <div className="fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '4rem 2rem' }}>
      <div style={{ marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <LuSettings size={36} />
        <div>
          <h1 style={{ fontSize: '3rem', marginBottom: '0.2rem' }}>Settings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Modify your profile details and preferences.</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        style={{
          backgroundColor: 'var(--surface-color)',
          border: '1px solid var(--border-color)',
          padding: '3rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
        }}
      >
        {error && (
          <div style={{ color: 'var(--error-color)', backgroundColor: 'rgba(239,68,68,0.1)', padding: '1rem', border: '1px solid var(--error-color)', fontSize: '13px', fontWeight: 600 }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ color: 'var(--success-color)', backgroundColor: 'rgba(34,197,94,0.1)', padding: '1rem', border: '1px solid var(--success-color)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LuCheck size={16} /> {success}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor="settings-username" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LuUser size={13} /> Username
          </label>
          <input
            id="settings-username"
            type="text"
            value={formData.nombre_usuario}
            onChange={e => updateField('nombre_usuario', e.target.value)}
            onBlur={e => validateField('nombre_usuario', e.target.value)}
            maxLength={20}
            style={inputStyle('nombre_usuario')}
            aria-invalid={!!fieldErrors.nombre_usuario}
          />
          <FieldError message={fieldErrors.nombre_usuario} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor="settings-email" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LuMail size={13} /> Email Address
          </label>
          <input
            id="settings-email"
            type="email"
            value={formData.correo}
            onChange={e => updateField('correo', e.target.value)}
            onBlur={e => validateField('correo', e.target.value)}
            maxLength={254}
            style={inputStyle('correo')}
            aria-invalid={!!fieldErrors.correo}
          />
          <FieldError message={fieldErrors.correo} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor="settings-avatar" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LuImage size={13} /> Avatar URL
          </label>
          <input
            id="settings-avatar"
            type="url"
            value={formData.url_avatar}
            onChange={e => updateField('url_avatar', e.target.value)}
            onBlur={e => validateField('url_avatar', e.target.value)}
            placeholder="https://example.com/avatar.png"
            maxLength={500}
            style={inputStyle('url_avatar')}
            aria-invalid={!!fieldErrors.url_avatar}
          />
          <FieldError message={fieldErrors.url_avatar} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor="settings-country" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LuGlobe size={13} /> Country
          </label>
          <input
            id="settings-country"
            type="text"
            value={formData.pais}
            onChange={e => updateField('pais', e.target.value)}
            onBlur={e => validateField('pais', e.target.value)}
            placeholder="e.g. Norway, USA"
            maxLength={50}
            style={inputStyle('pais')}
            aria-invalid={!!fieldErrors.pais}
          />
          <FieldError message={fieldErrors.pais} />
        </div>

        <button type="submit" disabled={saving} className="primary-btn" style={{ marginTop: '1rem', padding: '1rem', fontWeight: 700 }}>
          {saving ? 'Persisting changes...' : 'Save Configuration'}
        </button>
      </form>
    </div>
  );
};

export default SettingsPage;
