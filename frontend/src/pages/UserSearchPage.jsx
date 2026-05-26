import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/auth';
import { LuSearch, LuUserPlus, LuCheck } from 'react-icons/lu';
import FieldError from '../components/FieldError';
import { validateSearchQuery } from '../utils/validation';
import { useToast } from '../context/ToastContext';

const UserSearchPage = () => {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [queryError, setQueryError] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sentRequests, setSentRequests] = useState({});

  const handleSearch = async (e) => {
    e.preventDefault();
    const err = validateSearchQuery(query);
    setQueryError(err || '');
    if (err) {
      setSearched(false);
      return;
    }
    const trimmed = query.trim();
    setLoading(true);
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(trimmed)}`);
      setResults(data.results || []);
      setSearched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (userId) => {
    try {
      await api.post(`/friends/request?targetID=${userId}`);
      setSentRequests(prev => ({ ...prev, [userId]: true }));
    } catch {
      showToast('Could not send friend request. It may already be pending.');
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem' }}>
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>Search</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Query the global database for players and masters.</p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleSearch} noValidate style={{ marginBottom: '3rem' }}>
        <div style={{
          display: 'flex',
          border: `1px solid ${queryError ? 'var(--error-color)' : 'var(--border-color)'}`,
          backgroundColor: 'var(--surface-color)',
          overflow: 'hidden',
        }}>
          <div style={{ paddingLeft: '1.2rem', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
            <LuSearch size={20} />
          </div>
          <input
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              if (queryError) setQueryError('');
            }}
            onBlur={() => {
              if (query.trim()) setQueryError(validateSearchQuery(query) || '');
            }}
            maxLength={50}
            placeholder="Enter username (2–50 characters)..."
            aria-invalid={!!queryError}
            style={{
              flex: 1, padding: '1.2rem',
              backgroundColor: 'transparent', border: 'none',
              fontSize: '15px',
            }}
          />
          <button
            type="submit"
            className="primary-btn"
            disabled={loading}
            style={{ width: '120px', borderRadius: 0, fontWeight: 700 }}
          >
            {loading ? '...' : 'Search'}
          </button>
        </div>
        <FieldError message={queryError} />
      </form>

      {/* Results Section */}
      {searched && (
        <div style={{ border: '1px solid var(--border-color)' }}>
          {results.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
              No entries matched your search criteria.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ 
                padding: '0.75rem 1.5rem', 
                backgroundColor: 'var(--surface-color)', 
                borderBottom: '1px solid var(--border-color)',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
              }}>
                Identified Profiles ({results.length})
              </div>
              {results.map(u => (
                <div key={u.id} style={{
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1.5rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '40px', height: '40px',
                      backgroundColor: 'var(--border-color)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)'
                    }}>
                      {u.nombre_usuario?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px' }}>{u.nombre_usuario}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Rating: <span style={{ color: '#f59e0b', fontWeight: 700 }}>{u.userELO || 1200}</span>
                        {u.pais && ` • ${u.pais}`}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <Link to={`/profile/${u.id}`} className="secondary-btn" style={{ padding: '6px 14px', fontSize: '12px' }}>
                      Profile
                    </Link>
                    <button
                      onClick={() => sendRequest(u.id)}
                      disabled={sentRequests[u.id]}
                      style={{
                        padding: '6px 14px', fontSize: '12px', fontWeight: 600,
                        backgroundColor: sentRequests[u.id] ? 'transparent' : 'var(--text-primary)',
                        color: sentRequests[u.id] ? 'var(--success-color)' : '#000',
                        border: sentRequests[u.id] ? '1px solid var(--success-color)' : 'none',
                        display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      {sentRequests[u.id] ? <><LuCheck size={14} /> Sent</> : <><LuUserPlus size={14} /> Add Friend</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!searched && (
        <div style={{ textAlign: 'center', padding: '6rem 0', opacity: 0.4 }}>
          <LuSearch size={40} style={{ marginBottom: '1rem' }} />
          <p style={{ fontSize: '14px' }}>Locate players globally and prepare for competition.</p>
        </div>
      )}
    </div>
  );
};

export default UserSearchPage;
