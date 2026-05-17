import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/auth';
import { LuUsers, LuUserPlus, LuMail, LuUserX, LuCheck, LuArrowRight } from 'react-icons/lu';

const TabButton = ({ active, onClick, icon: Icon, children, count }) => (
  <button onClick={onClick} style={{
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '1rem 1.5rem', fontWeight: 600, fontSize: '13px',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    borderBottom: active ? '2px solid var(--text-primary)' : '2px solid transparent',
    display: 'flex', alignItems: 'center', gap: '8px',
    transition: 'all 0.2s',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  }}>
    <Icon size={16} />
    {children}
    {count > 0 && (
      <span style={{ 
        backgroundColor: active ? 'var(--text-primary)' : 'var(--border-color)', 
        color: active ? '#000' : 'var(--text-primary)', 
        padding: '1px 6px', fontSize: '10px', fontWeight: 900 
      }}>{count}</span>
    )}
  </button>
);

const FriendsPage = () => {
  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sentRequests, setSentRequests] = useState({});

  const fetchFriends = async () => {
    try {
      const { data } = await api.get('/friends');
      const all = Array.isArray(data) ? data : (data.friends || []);
      setFriends(all.filter(f => f.estado === 'accepted'));
      setRequests(all.filter(f => f.estado === 'pending'));
    } catch { }
    setLoading(false);
  };

  useEffect(() => { fetchFriends(); }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data.results || []);
    } catch { setSearchResults([]); }
  };

  const sendRequest = async (userId) => {
    try {
      await api.post(`/friends/request?targetID=${userId}`);
      setSentRequests(p => ({ ...p, [userId]: true }));
    } catch { alert('Operation failed.'); }
  };

  const acceptRequest = async (id) => {
    try { await api.put(`/friends/${id}/accept`); fetchFriends(); }
    catch { alert('Accept failed.'); }
  };

  const rejectRequest = async (id) => {
    try { await api.delete(`/friends/${id}/reject`); fetchFriends(); }
    catch { alert('Reject failed.'); }
  };

  const removeFriend = async (id) => {
    if (!confirm('Dissolve this connection?')) return;
    try { await api.delete(`/friends/${id}`); fetchFriends(); }
    catch { alert('Removal failed.'); }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem' }}>
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>Social</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Network management and connection invitations.</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '3rem' }}>
        <TabButton active={tab === 'friends'} onClick={() => setTab('friends')} icon={LuUsers} count={friends.length}>Connections</TabButton>
        <TabButton active={tab === 'requests'} onClick={() => setTab('requests')} icon={LuMail} count={requests.length}>Requests</TabButton>
        <TabButton active={tab === 'search'} onClick={() => setTab('search')} icon={LuUserPlus}>Discovery</TabButton>
      </div>

      {tab === 'friends' && (
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)' }}>
          {friends.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>No established connections found.</div>
          ) : friends.map(f => (
            <div key={f.id} style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{f.amigo_name?.[0]?.toUpperCase()}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>{f.amigo_name}</div>
                  <div style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 700 }}>{f.userELO || 1200} pts</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Link to={`/profile/${f.amigo_id}`} className="secondary-btn" style={{ fontSize: '11px', padding: '6px 12px' }}>View</Link>
                <button onClick={() => removeFriend(f.amigo_id)} style={{ backgroundColor: 'transparent', color: 'var(--error-color)', fontSize: '11px', fontWeight: 600 }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)' }}>
          {requests.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>Inbox is empty.</div>
          ) : requests.map(r => (
            <div key={r.id} style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#09090b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--text-primary)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>!</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{r.amigo_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Incoming invitation</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => acceptRequest(r.usuario_id)} className="primary-btn" style={{ padding: '6px 16px', fontSize: '11px' }}>Verify</button>
                <button onClick={() => rejectRequest(r.usuario_id)} className="secondary-btn" style={{ padding: '6px 16px', fontSize: '11px' }}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'search' && (
        <div>
          <form onSubmit={handleSearch} style={{ display: 'flex', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', marginBottom: '2rem' }}>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Username search..." style={{ flex: 1, padding: '1rem', background: 'transparent', border: 'none' }} />
            <button type="submit" className="primary-btn" style={{ width: '100px', borderRadius: 0 }}>Scan</button>
          </form>
          <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)' }}>
            {searchResults.map(u => (
              <div key={u.id} style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                   <div style={{ fontSize: '14px', fontWeight: 700 }}>{u.nombre_usuario}</div>
                   <div style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 700 }}>{u.userELO || 1200}</div>
                </div>
                <button onClick={() => sendRequest(u.id)} disabled={sentRequests[u.id]} className="secondary-btn" style={{ fontSize: '11px', padding: '4px 12px' }}>
                  {sentRequests[u.id] ? 'Sent' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FriendsPage;
