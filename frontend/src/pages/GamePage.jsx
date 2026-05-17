import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { LuFlag, LuRotateCcw, LuUser, LuClock, LuMessageSquare, LuX, LuSend } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';
import api from '../api/auth';

const GamePage = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [game, setGame] = useState(new Chess());
  const [moveCount, setMoveCount] = useState(0);
  const [match, setMatch] = useState(null);
  const [whitePlayer, setWhitePlayer] = useState({ nombre_usuario: 'Loading...', userELO: 1200 });
  const [blackPlayer, setBlackPlayer] = useState({ nombre_usuario: 'Loading...', userELO: 1200 });
  const [loading, setLoading] = useState(true);

  // Chat states
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  const wsRef = useRef(null);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat]);

  // Load game details and profiles
  const loadGameData = async () => {
    try {
      const response = await api.get(`/match/${matchId}`);
      const matchData = response.data;
      setMatch(matchData);

      // Reconstruct board state from moves
      const newGame = new Chess();
      const moves = matchData.movimientos_pgn ? matchData.movimientos_pgn.split(' ') : [];
      for (let m of moves) {
        try {
          newGame.move(m);
        } catch (e) {
          console.error("Error loading historical move: ", m, e);
        }
      }
      setGame(newGame);
      setMoveCount(moves.length);

      // Fetch player profiles to display correct names and ratings
      try {
        const whiteRes = await api.get(`/profile/${matchData.jugador_blancas_id}`);
        setWhitePlayer(whiteRes.data);
      } catch (e) {
        setWhitePlayer({ nombre_usuario: 'White Player', userELO: 1200 });
      }

      try {
        const blackRes = await api.get(`/profile/${matchData.jugador_negras_id}`);
        setBlackPlayer(blackRes.data);
      } catch (e) {
        setBlackPlayer({ nombre_usuario: 'Black Player', userELO: 1200 });
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      alert("Failed to load match details.");
      navigate('/dashboard');
    }
  };

  useEffect(() => {
    loadGameData();
  }, [matchId]);

  // Establish WebSocket connection
  useEffect(() => {
    if (loading || !match) return;

    const token = localStorage.getItem('token');
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host === 'localhost:5173' || window.location.host === '127.0.0.1:5173'
      ? 'localhost:8000'
      : window.location.host;
    const wsUrl = `${wsProto}//${wsHost}/api/match/${matchId}/ws?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'move_made') {
        const newGame = new Chess(data.board_state);
        setGame(newGame);
        setMoveCount(c => c + 1);
        
        // Update match state
        setMatch(prev => ({
          ...prev,
          estado: data.match_status,
          resultado: data.resultado,
          ganador_id: data.winner_id,
          movimientos_pgn: data.movimientos_pgn
        }));

        if (data.match_status === 'finished') {
          // If match finished from checkmate or draw
          const eloDiff = user?.id === data.winner_id ? 15 : (data.winner_id ? -15 : 0);
          setTimeout(() => {
            navigate('/result', { 
              state: { 
                matchData: { 
                  resultado: data.resultado, 
                  color_usuario: user?.id === match.jugador_blancas_id ? 'white' : 'black' 
                }, 
                eloDiff 
              } 
            });
          }, 1500);
        }
      } else if (data.type === 'match_ended') {
        // Handle resignation/draw agreement
        const userColor = user?.id === match.jugador_blancas_id ? 'white' : 'black';
        const isWinner = data.winner_id === user?.id;
        const eloDiff = data.resultado === 'draw' ? 0 : (isWinner ? 16 : -16);
        
        navigate('/result', {
          state: {
            matchData: {
              resultado: data.resultado,
              color_usuario: userColor
            },
            eloDiff
          }
        });
      } else if (data.type === 'chat') {
        setMessages(prev => [...prev, { username: data.username, message: data.message }]);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket Error: ", err);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [loading, match]);

  // Handle move drop on board
  const onDrop = async (source, target) => {
    if (!match || match.estado !== 'in_progress') return false;

    // Determine current user color
    const userColor = user?.id === match.jugador_blancas_id ? 'white' : 'black';
    const currentTurnColor = game.turn() === 'w' ? 'white' : 'black';

    if (userColor !== currentTurnColor) {
      alert("It is not your turn!");
      return false;
    }

    const originalFen = game.fen();

    try {
      // Pawn promotion check
      const piece = game.get(source);
      const isPromotion = piece && piece.type === 'p' && (target[1] === '8' || target[1] === '1');
      const uciMove = isPromotion ? `${source}${target}q` : `${source}${target}`;

      // Optimistic state update
      const tempGame = new Chess(originalFen);
      const localMove = tempGame.move({ from: source, to: target, promotion: 'q' });
      if (localMove === null) return false;

      setGame(tempGame);

      // Call API
      const response = await api.post(`/match/${matchId}/move`, { move: uciMove });
      
      // Update with exact state from server
      const newGame = new Chess(response.data.board_state);
      setGame(newGame);
      return true;
    } catch (err) {
      // Revert FEN on error
      setGame(new Chess(originalFen));
      const errMsg = err.response?.data?.detail || "Invalid move.";
      alert(errMsg);
      return false;
    }
  };

  // Handle resign
  const handleResign = async () => {
    if (!match || match.estado !== 'in_progress') return;
    if (!confirm("Are you sure you want to resign?")) return;

    try {
      await api.put(`/match/${matchId}/end`, { reason: 'victory' });
    } catch (err) {
      console.error(err);
      alert("Failed to resign.");
    }
  };

  // Send chat message
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'chat', message: chatInput }));
    setChatInput('');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        Entering game lobby...
      </div>
    );
  }

  const userColor = user?.id === match.jugador_blancas_id ? 'white' : 'black';
  const myTurn = (game.turn() === 'w' && userColor === 'white') || (game.turn() === 'b' && userColor === 'black');
  
  // Arrange players (Opponent on top, Current User on bottom)
  const opponent = userColor === 'white' ? blackPlayer : whitePlayer;
  const me = userColor === 'white' ? whitePlayer : blackPlayer;

  const PlayerInfo = ({ player, isBottom }) => (
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
          <div style={{ fontSize: '14px', fontWeight: 800 }}>
            {player?.nombre_usuario || 'Waiting...'}
            {player?.id === user?.id && <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '11px' }}> (You)</span>}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>RANK {player?.userELO || 1200}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 700, fontFamily: 'monospace' }}>
        <LuClock size={16} style={{ color: 'var(--text-secondary)' }} /> {match.control_tiempo}
      </div>
    </div>
  );

  return (
    <div style={{ 
      maxWidth: '1200px', margin: '0 auto', padding: '2rem',
      display: 'grid', gridTemplateColumns: 'minmax(400px, 600px) 1fr', gap: '3rem',
      position: 'relative'
    }}>
      
      {/* Chessboard Area */}
      <div>
        <PlayerInfo player={opponent} />
        
        <div style={{ 
          border: '1px solid var(--border-color)', 
          padding: '10px', 
          backgroundColor: '#18181b',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
        }}>
          <Chessboard 
            position={game.fen()} 
            onPieceDrop={onDrop}
            boardOrientation={userColor}
            arePiecesDraggable={match.estado === 'in_progress' && myTurn}
            customDarkSquareStyle={{ backgroundColor: '#09090b' }}
            customLightSquareStyle={{ backgroundColor: '#27272a' }}
            customBoardStyle={{ borderRadius: '0px' }}
          />
        </div>

        <PlayerInfo player={me} isBottom />
      </div>

      {/* Control Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
        
        {/* Match Header */}
        <div style={{ padding: '1.5rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '4px', textTransform: 'capitalize' }}>
            {match.modo} Ranked Match
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Match ID: #{match.id}
          </p>
          <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 800 }}>
            {match.estado === 'in_progress' ? (
              <span style={{ color: myTurn ? 'var(--success-color)' : 'var(--text-secondary)' }}>
                {myTurn ? "⚡ YOUR TURN" : "⌛ OPPONENT'S TURN"}
              </span>
            ) : (
              <span style={{ color: 'var(--error-color)' }}>MATCH FINISHED ({match.resultado})</span>
            )}
          </div>
        </div>

        {/* Notation/History Box */}
        <div style={{ 
          flex: 1, backgroundColor: 'var(--surface-color)', 
          border: '1px solid var(--border-color)', position: 'relative',
          minHeight: '200px', display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Notation Engine
          </div>
          <div style={{ padding: '1rem', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'monospace', overflowY: 'auto', flex: 1 }}>
            {moveCount === 0 || !match?.movimientos_pgn ? 'Awaiting initial opening...' : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {match.movimientos_pgn.trim().split(' ').reduce((acc, move, idx) => {
                  if (idx % 2 === 0) {
                    acc.push({ turn: Math.floor(idx / 2) + 1, white: move, black: '' });
                  } else {
                    acc[acc.length - 1].black = move;
                  }
                  return acc;
                }, []).map((t, idx) => (
                  <React.Fragment key={idx}>
                    <div style={{ color: 'var(--text-secondary)' }}>{t.turn}.</div>
                    <div>{t.white}</div>
                    <div>{t.black}</div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Interaction Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', backgroundColor: 'var(--border-color)', border: '1px solid var(--border-color)' }}>
          <button 
            disabled={match.estado !== 'in_progress'}
            style={{ backgroundColor: 'var(--surface-color)', padding: '1rem', color: match.estado === 'in_progress' ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            <LuRotateCcw size={16} /> Draw Offer
          </button>
          <button 
            onClick={handleResign}
            disabled={match.estado !== 'in_progress'}
            style={{ backgroundColor: 'var(--surface-color)', padding: '1rem', color: match.estado === 'in_progress' ? 'var(--error-color)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            <LuFlag size={16} /> Resign
          </button>
        </div>

        <button 
          onClick={() => setShowChat(true)}
          className="secondary-btn" 
          style={{ width: '100%', height: '50px', justifyContent: 'center' }}
        >
          <LuMessageSquare size={18} /> Open Tactical Chat
        </button>
      </div>

      {/* Sliding Chat Drawer */}
      {showChat && (
        <div style={{
          position: 'fixed', top: 0, right: 0, width: '350px', height: '100vh',
          backgroundColor: '#0c0b0a', borderLeft: '1px solid var(--border-color)',
          zIndex: 1000, display: 'flex', flexDirection: 'column',
          boxShadow: '-10px 0px 40px rgba(0, 0, 0, 0.7)'
        }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
              <LuMessageSquare size={18} /> Tactical Chat
            </div>
            <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <LuX size={20} />
            </button>
          </div>

          {/* Messages list */}
          <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', marginTop: '2rem' }}>
                Keep it tactical. Good luck, have fun!
              </div>
            ) : messages.map((m, idx) => {
              const isMe = m.username === user?.nombre_usuario;
              return (
                <div key={idx} style={{
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  textAlign: isMe ? 'right' : 'left'
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px', fontWeight: 700 }}>
                    {m.username}
                  </div>
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '13px',
                    backgroundColor: isMe ? 'var(--text-primary)' : 'var(--surface-color)',
                    color: isMe ? '#000' : 'var(--text-primary)',
                    fontWeight: isMe ? 600 : 500
                  }}>
                    {m.message}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input form */}
          <form onSubmit={handleSendChat} style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              value={chatInput} 
              onChange={e => setChatInput(e.target.value)} 
              placeholder="Send tactical message..." 
              style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', fontSize: '13px' }}
            />
            <button type="submit" className="primary-btn" style={{ padding: '0px 16px', borderRadius: '4px' }}>
              <LuSend size={16} />
            </button>
          </form>
        </div>
      )}

    </div>
  );
};

export default GamePage;
