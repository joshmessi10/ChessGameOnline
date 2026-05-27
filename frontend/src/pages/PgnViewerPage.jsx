import React, { useState, useCallback, useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { LuUpload, LuChevronLeft, LuChevronRight, LuChevronsLeft, LuChevronsRight, LuRotateCcw, LuFileText, LuX, LuClipboard } from 'react-icons/lu';

const PgnViewerPage = () => {
  const [pgnInput, setPgnInput] = useState('');
  const [game, setGame] = useState(null);
  const [moves, setMoves] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [positions, setPositions] = useState([]);
  const [headers, setHeaders] = useState({});
  const [error, setError] = useState('');
  const [boardOrientation, setBoardOrientation] = useState('white');

  const loadPgn = useCallback(() => {
    setError('');
    const trimmed = pgnInput.trim();
    if (!trimmed) {
      setError('Please paste a PGN to analyze.');
      return;
    }

    try {
      const tempGame = new Chess();
      const success = tempGame.loadPgn(trimmed);
      if (!success) {
        setError('Invalid PGN format. Please check and try again.');
        return;
      }

      const parsedHeaders = tempGame.header();
      const history = tempGame.history({ verbose: true });

      const posArr = [];
      const replayGame = new Chess();
      posArr.push(replayGame.fen());
      for (const move of history) {
        replayGame.move(move.san);
        posArr.push(replayGame.fen());
      }

      setHeaders(parsedHeaders);
      setMoves(history);
      setPositions(posArr);
      setCurrentMoveIndex(-1);
      setGame(new Chess());
    } catch (e) {
      setError('Could not parse PGN: ' + (e.message || 'Unknown error'));
    }
  }, [pgnInput]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPgnInput(text);
    } catch {
      // clipboard API may fail silently
    }
  }, []);

  const goToMove = useCallback((idx) => {
    if (!positions.length) return;
    const clamped = Math.max(-1, Math.min(idx, positions.length - 2));
    setCurrentMoveIndex(clamped);
    setGame(new Chess(positions[clamped + 1]));
  }, [positions]);

  const goStart = () => goToMove(-1);
  const goPrev = () => goToMove(currentMoveIndex - 1);
  const goNext = () => goToMove(currentMoveIndex + 1);
  const goEnd = () => goToMove(positions.length - 2);

  // Keyboard navigation
  React.useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      if (e.key === 'Home') { e.preventDefault(); goStart(); }
      if (e.key === 'End') { e.preventDefault(); goEnd(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const currentFen = positions.length ? positions[currentMoveIndex + 1] : 'start';

  const moveListPairs = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push({
        number: Math.floor(i / 2) + 1,
        white: moves[i],
        whiteIdx: i,
        black: moves[i + 1] || null,
        blackIdx: i + 1,
      });
    }
    return pairs;
  }, [moves]);

  const resultText = headers.Result || '';

  const isLoaded = moves.length > 0;

  return (
    <div className="fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '4rem 2rem' }}>

      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>PGN Analyzer</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Load any game in standard PGN format and replay it move by move.</p>
      </div>

      {/* PGN Input Section */}
      {!isLoaded ? (
        <div style={{
          backgroundColor: 'var(--surface-color)',
          border: '1px solid var(--border-color)',
          padding: '2.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <LuFileText size={20} style={{ color: '#f59e0b' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>Paste PGN</h2>
          </div>

          <textarea
            value={pgnInput}
            onChange={(e) => { setPgnInput(e.target.value); setError(''); }}
            placeholder={`[Event "World Championship"]\n[Site "Reykjavik"]\n[Date "1972.07.23"]\n[White "Fischer, Robert J."]\n[Black "Spassky, Boris V."]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ...`}
            style={{
              width: '100%',
              minHeight: '220px',
              padding: '1.25rem',
              backgroundColor: '#000',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: '13px',
              lineHeight: '1.6',
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--text-secondary)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
          />

          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--error-color)',
              color: 'var(--error-color)',
              fontSize: '13px',
              fontWeight: 600
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={loadPgn} className="primary-btn" style={{ padding: '12px 32px', fontSize: '14px' }}>
              <LuUpload size={16} /> Load Game
            </button>
            <button onClick={handlePaste} className="secondary-btn" style={{ padding: '12px 24px', fontSize: '13px' }}>
              <LuClipboard size={14} /> Paste from Clipboard
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Game Info Header */}
          {(headers.White || headers.Black) && (
            <div style={{
              backgroundColor: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              padding: '1.5rem 2rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '18px', height: '18px', backgroundColor: '#f4f4f5', border: '2px solid #52525b' }} />
                  <span style={{ fontWeight: 700, fontSize: '16px' }}>{headers.White || 'White'}</span>
                  {headers.WhiteElo && <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 700 }}>({headers.WhiteElo})</span>}
                </div>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 800, fontSize: '14px' }}>vs</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '18px', height: '18px', backgroundColor: '#18181b', border: '2px solid #52525b' }} />
                  <span style={{ fontWeight: 700, fontSize: '16px' }}>{headers.Black || 'Black'}</span>
                  {headers.BlackElo && <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 700 }}>({headers.BlackElo})</span>}
                </div>
                {resultText && (
                  <span style={{
                    marginLeft: '0.5rem',
                    padding: '3px 10px',
                    fontSize: '11px',
                    fontWeight: 800,
                    backgroundColor: resultText === '1-0' ? 'rgba(255,255,255,0.1)' : resultText === '0-1' ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.15)',
                    color: resultText === '1/2-1/2' ? '#f59e0b' : 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    letterSpacing: '0.05em'
                  }}>{resultText}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {headers.Event && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{headers.Event}</span>}
                {headers.Date && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{headers.Date}</span>}
                {headers.ECO && <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 700 }}>{headers.ECO}</span>}
              </div>
            </div>
          )}

          {/* Main Grid: Board + Move List */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(350px, 560px) 1fr',
            gap: '1.5rem',
            alignItems: 'start'
          }}>
            {/* Board Column */}
            <div>
              <div style={{
                border: '1px solid var(--border-color)',
                padding: '10px',
                backgroundColor: '#18181b',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }}>
                <Chessboard
                  position={currentFen}
                  boardOrientation={boardOrientation}
                  arePiecesDraggable={false}
                  animationDuration={200}
                />
              </div>

              {/* Controls */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '4px',
                marginTop: '1rem',
                padding: '0.75rem',
                backgroundColor: 'var(--surface-color)',
                border: '1px solid var(--border-color)'
              }}>
                <ControlBtn onClick={goStart} disabled={currentMoveIndex <= -1} title="Start (Home)"><LuChevronsLeft size={18} /></ControlBtn>
                <ControlBtn onClick={goPrev} disabled={currentMoveIndex <= -1} title="Previous (←)"><LuChevronLeft size={18} /></ControlBtn>
                <div style={{ padding: '0 12px', fontSize: '13px', fontFamily: 'monospace', color: 'var(--text-secondary)', fontWeight: 700, minWidth: '80px', textAlign: 'center' }}>
                  {currentMoveIndex >= 0 ? `${Math.floor(currentMoveIndex / 2) + 1}. ${currentMoveIndex % 2 === 0 ? '' : '...'}${moves[currentMoveIndex]?.san}` : 'Start'}
                </div>
                <ControlBtn onClick={goNext} disabled={currentMoveIndex >= moves.length - 1} title="Next (→)"><LuChevronRight size={18} /></ControlBtn>
                <ControlBtn onClick={goEnd} disabled={currentMoveIndex >= moves.length - 1} title="End"><LuChevronsRight size={18} /></ControlBtn>
                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 8px' }} />
                <ControlBtn onClick={() => setBoardOrientation(o => o === 'white' ? 'black' : 'white')} title="Flip Board"><LuRotateCcw size={16} /></ControlBtn>
                <ControlBtn onClick={() => { setGame(null); setMoves([]); setPositions([]); setCurrentMoveIndex(-1); setHeaders({}); }} title="Load New PGN"><LuX size={16} /></ControlBtn>
              </div>

              {/* Move counter */}
              <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Move {currentMoveIndex + 1} of {moves.length} &bull; Use arrow keys to navigate
              </div>
            </div>

            {/* Move List Column */}
            <div style={{
              backgroundColor: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '620px'
            }}>
              <div style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--text-secondary)'
              }}>
                Move List
              </div>
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.5rem'
              }}>
                {moveListPairs.map((pair) => (
                  <div key={pair.number} style={{
                    display: 'grid',
                    gridTemplateColumns: '36px 1fr 1fr',
                    fontSize: '13px',
                    lineHeight: 1
                  }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, padding: '8px 4px', textAlign: 'right', paddingRight: '10px' }}>{pair.number}.</span>
                    <MoveCell
                      san={pair.white.san}
                      isActive={currentMoveIndex === pair.whiteIdx}
                      onClick={() => goToMove(pair.whiteIdx)}
                    />
                    {pair.black ? (
                      <MoveCell
                        san={pair.black.san}
                        isActive={currentMoveIndex === pair.blackIdx}
                        onClick={() => goToMove(pair.blackIdx)}
                      />
                    ) : <span />}
                  </div>
                ))}
                {resultText && (
                  <div style={{ textAlign: 'center', padding: '12px', fontSize: '14px', fontWeight: 800, color: '#f59e0b', borderTop: '1px solid var(--border-color)', marginTop: '4px' }}>
                    {resultText}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const ControlBtn = ({ children, onClick, disabled, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      width: '40px',
      height: '36px',
      backgroundColor: 'transparent',
      color: disabled ? '#3f3f46' : 'var(--text-primary)',
      border: '1px solid transparent',
      cursor: disabled ? 'default' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.15s'
    }}
    onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.backgroundColor = 'var(--accent-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}}
    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
  />
);
ControlBtn.defaultProps = { disabled: false };

const MoveCell = ({ san, isActive, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: isActive ? '#f59e0b' : 'transparent',
      color: isActive ? '#000' : 'var(--text-primary)',
      border: 'none',
      padding: '8px 10px',
      fontSize: '13px',
      fontWeight: isActive ? 800 : 500,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      cursor: 'pointer',
      textAlign: 'left',
      transition: 'all 0.1s',
      display: 'block',
      width: '100%'
    }}
    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = '#1a1a1f'; }}
    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
  >
    {san}
  </button>
);

export default PgnViewerPage;