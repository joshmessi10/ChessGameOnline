import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { LuArrowLeft, LuFileText, LuUser, LuCalendar, LuTrophy, LuInfo } from 'react-icons/lu';

const MatchDetailPage = () => {
  const { matchId } = useParams();
  const { user } = useAuth();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/match/${matchId}`)
      .then(r => setMatch(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [matchId]);

  if (loading) return <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Retrieving match analysis...</div>;
  if (!match) return <div style={{ padding: '5rem', textAlign: 'center' }}>Match log not found.</div>;

  const isWhite = match.jugador_blancas_id === user?.id;
  const resultText = match.resultado === 'draw' ? 'Draw' : 
                    (match.resultado === (isWhite ? 'white_win' : 'black_win') ? 'Victory' : 'Defeat');

  return (
    <div className="fade-in" style={{ maxWidth: '900px', margin: '0 auto', padding: '4rem 2rem' }}>
      <Link to="/profile/me" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '3rem', fontWeight: 600 }}>
        <LuArrowLeft size={16} /> Back to History
      </Link>

      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', 
        marginBottom: '4rem', paddingBottom: '3rem', borderBottom: '1px solid var(--border-color)' 
      }}>
        <div>
          <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>Match Analysis</h1>
          <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><LuCalendar size={14} /> {new Date(match.creada_en).toLocaleDateString()}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><LuInfo size={14} /> {match.modo.toUpperCase()}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: resultText === 'Victory' ? 'var(--success-color)' : (resultText === 'Draw' ? '#f59e0b' : 'var(--error-color)'), letterSpacing: '0.1em', marginBottom: '4px' }}>Outcome</div>
          <div style={{ fontSize: '36px', fontWeight: 900 }}>{resultText.toUpperCase()}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', backgroundColor: 'var(--border-color)', border: '1px solid var(--border-color)', marginBottom: '4rem' }}>
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LuUser size={14} /> White Pieces
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>
            {match.playerWhiteUsername} {match.jugador_blancas_id === user?.id && <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>(You)</span>}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LuUser size={14} /> Black Pieces
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>
            {match.playerBlackUsername} {match.jugador_negras_id === user?.id && <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>(You)</span>}
          </div>
        </div>
      </div>


      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-secondary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LuFileText size={18} /> Notation (PGN)
        </h3>
        <div style={{ 
          backgroundColor: 'var(--surface-color)', 
          border: '1px solid var(--border-color)', 
          padding: '2rem', 
          fontFamily: 'monospace', 
          fontSize: '14px', 
          lineHeight: 1.8, 
          color: 'var(--text-secondary)',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          {match.movimientos_pgn || 'No notation data recorded for this match.'}

        </div>
      </div>

      <div style={{ marginTop: '4rem', padding: '2rem', backgroundColor: '#09090b', border: '1px solid var(--border-color)', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Want to analyze this position with the engine?</p>
        <button className="primary-btn" style={{ fontSize: '12px', padding: '10px 24px' }}>Export to Analysis Tool</button>
      </div>
    </div>
  );
};

export default MatchDetailPage;
