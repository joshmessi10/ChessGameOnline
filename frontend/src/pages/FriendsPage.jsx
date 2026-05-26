import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/auth';
import { LuUsers, LuUserPlus, LuMail, LuUserX, LuCheck, LuArrowRight } from 'react-icons/lu';
import FieldError from '../components/FieldError';
import { validateSearchQuery } from '../utils/validation';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

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
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [gameInvites, setGameInvites] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchQueryError, setSearchQueryError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sentRequests, setSentRequests] = useState({});

  // Challenge Modal States
  const [challengeFriend, setChallengeFriend] = useState(null); // { id, name }
  const [matchType, setMatchType] = useState('blitz');
  const [timeControl, setTimeControl] = useState('3+2');

  const fetchFriends = async () => {
    try {
      const { data } = await api.get('/friends');
      const all = Array.isArray(data) ? data : (data.friends || []);
      setFriends(all.filter(f => f.estado === 'accepted'));
      setRequests(all.filter(f => f.estado === 'pending'));

      const resInv = await api.get('/match/invite/pending');
      setGameInvites(resInv.data || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { fetchFriends(); }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    const err = validateSearchQuery(searchQuery);
    setSearchQueryError(err || '');
    if (err) {
      setSearchResults([]);
      return;
    }
    const trimmed = searchQuery.trim();
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(trimmed)}`);
      setSearchResults(data.results || []);
    } catch { setSearchResults([]); }
  };

  const sendRequest = async (userId) => {
    try {
      await api.post(`/friends/request?targetID=${userId}`);
      setSentRequests(p => ({ ...p, [userId]: true }));
    } catch {
      showToast('Could not send friend request. It may already be pending.');
    }
  };

  const acceptRequest = async (id) => {
    try { await api.put(`/friends/${id}/accept`); fetchFriends(); }
    catch { showToast('Could not accept the friend request.'); }
  };

  const rejectRequest = async (id) => {
    try { await api.delete(`/friends/${id}/reject`); fetchFriends(); }
    catch { showToast('Could not decline the friend request.'); }
  };

  const removeFriend = async (id, friendName) => {
    const ok = await confirm({
      title: 'Remove connection',
      message: `Remove ${friendName || 'this player'} from your friends?`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    try { await api.delete(`/friends/${id}`); fetchFriends(); }
    catch { showToast('Could not remove this connection.'); }
  };

  const handleSendChallenge = async () => {
    if (!challengeFriend) return;
    try {
      const { data } = await api.post('/match/invite', {
        friend_id: challengeFriend.id,
        modo: matchType,
        control_tiempo: timeControl
      });
      setChallengeFriend(null);
      navigate(`/play/${data.id}`);
    } catch {
      showToast('Could not send the challenge invitation.');
    }
  };

  const acceptGameInvite = async (inviteID) => {
    try {
      await api.put(`/match/invite/${inviteID}/accept`);
      navigate(`/play/${inviteID}`);
    } catch {
      showToast('Could not accept the game challenge.');
    }
  };

  const declineGameInvite = async (inviteID) => {
    try {
      await api.delete(`/match/invite/${inviteID}/decline`);
      fetchFriends();
    } catch {
      showToast('Could not decline the game challenge.');
    }
  };


  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem' }}>
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>Social</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Network management and connection invitations.</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '3rem' }}>
        <TabButton active={tab === 'friends'} onClick={() => setTab('friends')} icon={LuUsers} count={friends.length}>Connections</TabButton>
        <TabButton active={tab === 'requests'} onClick={() => setTab('requests')} icon={LuMail} count={requests.length + gameInvites.length}>Requests</TabButton>
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
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={() => setChallengeFriend({ id: f.amigo_id, name: f.amigo_name })} className="primary-btn" style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Challenge
                </button>
                <Link to={`/profile/${f.amigo_id}`} className="secondary-btn" style={{ fontSize: '11px', padding: '6px 12px' }}>View</Link>
                <button onClick={() => removeFriend(f.amigo_id, f.amigo_name)} style={{ backgroundColor: 'transparent', color: 'var(--error-color)', fontSize: '11px', fontWeight: 600, paddingLeft: '8px' }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '1rem', letterSpacing: '0.05em' }}>Friend Requests ({requests.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)' }}>
              {requests.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>No pending friend requests.</div>
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
          </div>

          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '1rem', letterSpacing: '0.05em' }}>Game Challenges ({gameInvites.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)' }}>
              {gameInvites.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>No active game challenges.</div>
              ) : gameInvites.map(inv => (
                <div key={inv.id} style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#09090b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', backgroundColor: '#f59e0b', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900, letterSpacing: '0.05em' }}>VS</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>{inv.inviter_username} <span style={{ color: '#f59e0b', fontSize: '12px' }}>({inv.inviter_elo} ELO)</span></div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Challenged you to {inv.modo.toUpperCase()} ({inv.control_tiempo})</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={() => acceptGameInvite(inv.id)} className="primary-btn" style={{ padding: '6px 16px', fontSize: '11px', backgroundColor: 'var(--success-color)', border: 'none', color: '#000' }}>Accept</button>
                    <button onClick={() => declineGameInvite(inv.id)} className="secondary-btn" style={{ padding: '6px 16px', fontSize: '11px' }}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'search' && (
        <div>
          <form onSubmit={handleSearch} noValidate style={{ marginBottom: '2rem' }}>
            <div style={{
              display: 'flex',
              border: `1px solid ${searchQueryError ? 'var(--error-color)' : 'var(--border-color)'}`,
              backgroundColor: 'var(--surface-color)',
            }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  if (searchQueryError) setSearchQueryError('');
                }}
                maxLength={50}
                placeholder="Username search (2–50 characters)..."
                aria-invalid={!!searchQueryError}
                style={{ flex: 1, padding: '1rem', background: 'transparent', border: 'none' }}
              />
              <button type="submit" className="primary-btn" style={{ width: '100px', borderRadius: 0 }}>Scan</button>
            </div>
            <FieldError message={searchQueryError} />
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

      {/* Challenge Modal */}
      {challengeFriend && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)',
            padding: '2.5rem', width: '90%', maxWidth: '400px',
            display: 'flex', flexDirection: 'column', gap: '1.5rem'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Challenge {challengeFriend.name}</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Game Mode</label>
              <select value={matchType} onChange={e => {
                setMatchType(e.target.value);
                if (e.target.value === 'bullet') setTimeControl('1+0');
                else if (e.target.value === 'blitz') setTimeControl('3+2');
                else if (e.target.value === 'rapid') setTimeControl('10+5');
                else setTimeControl('30+0');
              }} style={{
                backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)',
                padding: '0.8rem', color: 'var(--text-primary)', width: '100%', fontSize: '14px'
              }}>
                <option value="bullet">Bullet</option>
                <option value="blitz">Blitz</option>
                <option value="rapid">Rapid</option>
                <option value="classical">Classical</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Time Control</label>
              <select value={timeControl} onChange={e => setTimeControl(e.target.value)} style={{
                backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)',
                padding: '0.8rem', color: 'var(--text-primary)', width: '100%', fontSize: '14px'
              }}>
                {matchType === 'bullet' && (
                  <>
                    <option value="1+0">1+0 (Bullet)</option>
                    <option value="2+1">2+1 (Bullet)</option>
                  </>
                )}
                {matchType === 'blitz' && (
                  <>
                    <option value="3+0">3+0 (Blitz)</option>
                    <option value="3+2">3+2 (Blitz)</option>
                    <option value="5+0">5+0 (Blitz)</option>
                    <option value="5+3">5+3 (Blitz)</option>
                  </>
                )}
                {matchType === 'rapid' && (
                  <>
                    <option value="10+0">10+0 (Rapid)</option>
                    <option value="10+5">10+5 (Rapid)</option>
                    <option value="15+10">15+10 (Rapid)</option>
                  </>
                )}
                {matchType === 'classical' && (
                  <>
                    <option value="30+0">30+0 (Classical)</option>
                    <option value="30+30">30+30 (Classical)</option>
                  </>
                )}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={handleSendChallenge} className="primary-btn" style={{ flex: 1, padding: '12px' }}>Send Challenge</button>
              <button onClick={() => setChallengeFriend(null)} className="secondary-btn" style={{ flex: 1, padding: '12px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FriendsPage;

