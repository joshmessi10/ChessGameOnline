import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { LuFlag, LuRotateCcw, LuUser, LuClock, LuMessageSquare } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';

const GamePage = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [game, setGame] = useState(new Chess());
  const [moveCount, setMoveCount] = useState(0);

  const onDrop = (source, target) => {
    try {
      const move = game.move({ from: source, to: target, promotion: 'q' });
      if (move === null) return false;
      setGame(new Chess(game.fen()));
      setMoveCount(c => c + 1);
      return true;
    } catch {
      return false;
    }
  };

  const PlayerInfo = ({ name, elo, isBottom }) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '1rem', backgroundColor: 'var(--surface-color)',
      border: '1px solid var(--border-color)',
      marginBottom: isBottom ? 0 : '1rem',
      marginTop: isBottom ? '1rem' : 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '32px', height: '32px', backgroundColor: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LuUser size={16} />
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800 }}>{name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>RANK {elo}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 700, fontFamily: 'monospace' }}>
        <LuClock size={16} style={{ color: 'var(--text-secondary)' }} /> 10:00
      </div>
    </div>
  );

  return (
    <div className="fade-in" style={{ 
      maxWidth: '1200px', margin: '0 auto', padding: '2rem',
      display: 'grid', gridTemplateColumns: 'minmax(400px, 600px) 1fr', gap: '3rem'
    }}>
      
      {/* Chessboard Area */}
      <div>
        <PlayerInfo name="Opponent" elo={1240} />
        
        <div style={{ 
          border: '1px solid var(--border-color)', 
          padding: '10px', 
          backgroundColor: '#18181b',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
        }}>
          <Chessboard 
            position={game.fen()} 
            onPieceDrop={onDrop}
            customDarkSquareStyle={{ backgroundColor: '#09090b' }}
            customLightSquareStyle={{ backgroundColor: '#27272a' }}
            customBoardStyle={{ borderRadius: '0px' }}
          />
        </div>

        <PlayerInfo name={user?.username || 'You'} elo={1200} isBottom />
      </div>

      {/* Control Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Match Header */}
        <div style={{ padding: '1.5rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>Ranked Rapid Match</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Match ID: {matchId || '002-XJ'}</p>
        </div>

        {/* Notation/History Box */}
        <div style={{ 
          flex: 1, backgroundColor: 'var(--surface-color)', 
          border: '1px solid var(--border-color)', position: 'relative',
          minHeight: '300px'
        }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Notation Engine
          </div>
          <div style={{ padding: '1rem', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            {moveCount === 0 ? 'Awaiting initial opening...' : '1. e4 e5 2. Nf3 Nc6...'}
          </div>
        </div>

        {/* Interaction Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', backgroundColor: 'var(--border-color)', border: '1px solid var(--border-color)' }}>
          <button style={{ backgroundColor: 'var(--surface-color)', padding: '1rem', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>
            <LuRotateCcw size={16} /> Draw
          </button>
          <button 
            onClick={() => navigate('/result')}
            style={{ backgroundColor: 'var(--surface-color)', padding: '1rem', color: 'var(--error-color)', fontSize: '13px', fontWeight: 600 }}
          >
            <LuFlag size={16} /> Resign
          </button>
        </div>

        <button className="secondary-btn" style={{ width: '100%', height: '50px', justifyContent: 'center' }}>
          <LuMessageSquare size={18} /> Open Tactical Chat
        </button>
      </div>

    </div>
  );
};

export default GamePage;
