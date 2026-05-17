import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { LuUser, LuMail, LuImage, LuGlobe, LuSettings, LuCheck } from 'react-icons/lu';

const SettingsPage = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nombre_usuario: '',
    correo: '',
    url_avatar: '',
    pais: '',
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const res = await api.put(`/settings/${user.id}`, formData);
      updateUser(res.data);
      setSuccess('Settings updated successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to persist configurations.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '4rem 2rem' }}>
      <div style={{ marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <LuSettings size={36} />
        <div>
          <h1 style={{ fontSize: '3rem', marginBottom: '0.2rem' }}>Settings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Modify your profile details and preferences.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{
        backgroundColor: 'var(--surface-color)',
        border: '1px solid var(--border-color)',
        padding: '3rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem'
      }}>
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
          <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LuUser size={13} /> Username
          </label>
          <input
            type="text"
            required
            value={formData.nombre_usuario}
            onChange={e => setFormData({ ...formData, nombre_usuario: e.target.value })}
            style={{
              backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)',
              padding: '1rem', color: 'var(--text-primary)', fontSize: '14px'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LuMail size={13} /> Email Address
          </label>
          <input
            type="email"
            required
            value={formData.correo}
            onChange={e => setFormData({ ...formData, correo: e.target.value })}
            style={{
              backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)',
              padding: '1rem', color: 'var(--text-primary)', fontSize: '14px'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LuImage size={13} /> Avatar URL
          </label>
          <input
            type="url"
            value={formData.url_avatar}
            onChange={e => setFormData({ ...formData, url_avatar: e.target.value })}
            placeholder="https://example.com/avatar.png"
            style={{
              backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)',
              padding: '1rem', color: 'var(--text-primary)', fontSize: '14px'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LuGlobe size={13} /> Country
          </label>
          <input
            type="text"
            value={formData.pais}
            onChange={e => setFormData({ ...formData, pais: e.target.value })}
            placeholder="e.g. Norway, USA"
            style={{
              backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)',
              padding: '1rem', color: 'var(--text-primary)', fontSize: '14px'
            }}
          />
        </div>

        <button type="submit" disabled={saving} className="primary-btn" style={{ marginTop: '1rem', padding: '1rem', fontWeight: 700 }}>
          {saving ? 'Persisting changes...' : 'Save Configuration'}
        </button>
      </form>
    </div>
  );
};

export default SettingsPage;
