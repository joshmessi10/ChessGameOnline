import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LuArrowLeft, LuFileText, LuUser, LuCalendar, LuTrophy, LuInfo, LuChevronLeft, LuChevronRight, LuChevronsLeft, LuChevronsRight } from 'react-icons/lu';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

const MatchDetailPage = () => {
  const { matchID: matchId } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/match/${matchId}`)
      .then(r => setMatch(r.data))
      .catch((err) => {
        const detail = err?.response?.data?.detail;
        if (err?.response?.status === 404) {
          showToast('Match not found.', { type: 'error' });
        } else if (err?.response?.status === 403) {
          showToast('You are not a participant in this match.', { type: 'error' });
        } else {
          showToast(detail || 'Could not load match data.', { type: 'error' });
        }
      })
      .finally(() => setLoading(false));
  }, [matchId]);

  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [moves, setMoves] = useState([]);
  const [currentFen, setCurrentFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

  useEffect(() => {
    if (match && match.movimientos_pgn) {
      try {
        const chess = new Chess();
        chess.loadPgn(match.movimientos_pgn);
        const history = chess.history({ verbose: true });
        
        const chessTemp = new Chess();
        const movesWithFen = history.map(move => {
          chessTemp.move(move.san);
          return {
            san: move.san,
            fen: chessTemp.fen()
          };
        });
        setMoves(movesWithFen);
        if (movesWithFen.length > 0) {
          setCurrentMoveIndex(movesWithFen.length - 1);
          setCurrentFen(movesWithFen[movesWithFen.length - 1].fen);
        }
      } catch (e) {
        console.error("Error parsing PGN:", e);
      }
    }
  }, [match]);

  if (loading) return <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Retrieving match analysis...</div>;
  if (!match) return <div style={{ padding: '5rem', textAlign: 'center' }}>Match log not found.</div>;

  const isWhite = match.jugador_blancas_id === user?.id;
  const resultText = match.resultado === 'draw' ? 'Draw' : 
                    (match.resultado === (isWhite ? 'white_win' : 'black_win') ? 'Victory' : 'Defeat');

  const goToFirst = () => {
    setCurrentMoveIndex(-1);
    setCurrentFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  };

  const goToLast = () => {
    if (moves.length > 0) {
      setCurrentMoveIndex(moves.length - 1);
      setCurrentFen(moves[moves.length - 1].fen);
    }
  };

  const goToPrev = () => {
    if (currentMoveIndex > -1) {
      const newIndex = currentMoveIndex - 1;
      setCurrentMoveIndex(newIndex);
      setCurrentFen(newIndex === -1 ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' : moves[newIndex].fen);
    }
  };

  const goToNext = () => {
    if (currentMoveIndex < moves.length - 1) {
      const newIndex = currentMoveIndex + 1;
      setCurrentMoveIndex(newIndex);
      setCurrentFen(moves[newIndex].fen);
    }
  };

  const selectMove = (index) => {
    setCurrentMoveIndex(index);
    setCurrentFen(moves[index].fen);
  };

  return (
    <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto', padding: '4rem 2rem' }}>
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

      {/* Grid para Tablero y Movimientos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', marginBottom: '4rem' }}>
        {/* Columna Izquierda: Tablero y Controles */}
        <div>
          <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
            <Chessboard position={currentFen} arePiecesDraggable={false} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '1.5rem' }}>
            <button onClick={goToFirst} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }} title="First Move"><LuChevronsLeft size={20} /></button>
            <button onClick={goToPrev} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }} title="Previous Move"><LuChevronLeft size={20} /></button>
            <button onClick={goToNext} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }} title="Next Move"><LuChevronRight size={20} /></button>
            <button onClick={goToLast} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }} title="Last Move"><LuChevronsRight size={20} /></button>
          </div>
        </div>

        {/* Columna Derecha: Movimientos */}
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-secondary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LuFileText size={18} /> Moves
          </h3>
          <div style={{ 
            backgroundColor: 'var(--surface-color)', 
            border: '1px solid var(--border-color)', 
            padding: '1.5rem', 
            fontFamily: 'monospace', 
            fontSize: '14px', 
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {moves.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)' }}>No notation data recorded.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {moves.map((move, index) => (
                  <div 
                    key={index} 
                    onClick={() => selectMove(index)}
                    style={{ 
                      padding: '8px 12px', 
                      cursor: 'pointer', 
                      backgroundColor: currentMoveIndex === index ? '#2563eb' : 'transparent',
                      color: currentMoveIndex === index ? '#fff' : 'var(--text-primary)',
                      borderRadius: '4px',
                      textAlign: 'center',
                      border: '1px solid',
                      borderColor: currentMoveIndex === index ? '#2563eb' : 'var(--border-color)'
                    }}
                  >
                    {Math.floor(index / 2) + 1}.{index % 2 === 0 ? '' : '..'} {move.san}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '4rem', padding: '2rem', backgroundColor: '#09090b', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Download or analyze this game in standard PGN format.</p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="primary-btn"
            style={{ fontSize: '12px', padding: '10px 24px' }}
            onClick={() => {
              const pgn = match?.movimientos_pgn;
              if (!pgn) return;
              const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `match_${matchId}_${match.playerWhiteUsername}_vs_${match.playerBlackUsername}.pgn`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            disabled={!match?.movimientos_pgn}
          >
            <LuFileText size={14} /> Download PGN
          </button>
          <Link to="/pgn-viewer" className="secondary-btn" style={{ fontSize: '12px', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Open PGN Analyzer
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MatchDetailPage;
