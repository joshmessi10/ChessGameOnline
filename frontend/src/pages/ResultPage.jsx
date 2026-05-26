import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LuTrophy, LuTrendingUp, LuLayoutDashboard, LuPlay } from 'react-icons/lu';
import { formatEndReason } from '../utils/match';

const ResultPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { matchData, eloDiff } = state || { matchData: { resultado: 'draw' }, eloDiff: 0 };

  const isWin = matchData.resultado === (matchData.color_usuario === 'white' ? 'white_win' : 'black_win');
  const isDraw = matchData.resultado === 'draw';

  const outcomeTitle = isDraw
    ? (matchData.end_reason === 'stalemate' ? 'Stalemate' : 'Draw')
    : (isWin ? 'Victory' : 'Defeat');
  const outcomeColor = isDraw ? '#f59e0b' : (isWin ? 'var(--success-color)' : 'var(--error-color)');
  const endMethodLabel = formatEndReason(matchData.end_reason);

  return (
    <div className="fade-in" style={{
      minHeight: 'calc(100vh - 84px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{ width: '100%', maxWidth: '500px', textAlign: 'center' }}>

        <div style={{
          width: '100px', height: '100px', margin: '0 auto 3rem auto',
          border: `2px solid ${outcomeColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: outcomeColor,
        }}>
          {isWin ? <LuTrophy size={48} /> : (isDraw ? <LuTrendingUp size={48} /> : <LuLayoutDashboard size={48} />)}
        </div>

        <h1 style={{ fontSize: '4.5rem', marginBottom: '1rem', color: outcomeColor }}>{outcomeTitle}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '4rem', fontWeight: 500 }}>
          The encounter has concluded. Your performance record has been updated.
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px',
          backgroundColor: 'var(--border-color)', border: '1px solid var(--border-color)',
          marginBottom: '4rem',
        }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>Rating Adjustment</div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: eloDiff >= 0 ? 'var(--success-color)' : 'var(--error-color)' }}>
              {eloDiff >= 0 ? `+${eloDiff}` : eloDiff}
            </div>
          </div>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>End Method</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{endMethodLabel}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => navigate('/play')} className="primary-btn" style={{ flex: 1, height: '56px' }}>
            <LuPlay size={18} /> New Match
          </button>
          <button onClick={() => navigate('/dashboard')} className="secondary-btn" style={{ flex: 1, height: '56px' }}>
            <LuLayoutDashboard size={18} /> Dashboard
          </button>
        </div>

      </div>
    </div>
  );
};

export default ResultPage;
