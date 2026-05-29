import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { LuFlag, LuRotateCcw, LuUser, LuClock, LuMessageSquare, LuX, LuSend, LuSwords, LuHandshake, LuLoader } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/auth';
import { getPlayerColor, getUserOutcome, isMatchFinished } from '../utils/match';
import { coerceClockSeconds, formatClockSeconds } from '../utils/clock';

const parseMovesFromStoredPgn = (storedPgn) => {
  if (!storedPgn || typeof storedPgn !== 'string') return [];
  const normalized = storedPgn.trim();
  if (!normalized) return [];

  const chess = new Chess();
  try {
    if (chess.loadPgn(normalized)) {
      return chess.history();
    }
  } catch {
    // fallback to legacy tokenized notation
  }

  const fallback = [];
  const temp = new Chess();
  normalized.split(/\s+/).forEach((token) => {
    if (!token || token.includes('.') || token.startsWith('[')) return;
    try {
      const move = temp.move(token);
      if (move?.san) fallback.push(move.san);
    } catch {
      // ignore invalid tokens
    }
  });
  return fallback;
};

const GamePage = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const [game, setGame] = useState(new Chess());
  const [moveCount, setMoveCount] = useState(0);
  const [match, setMatch] = useState(null);
  const [whitePlayer, setWhitePlayer] = useState({ nombre_usuario: 'Loading...', userELO: 1200 });
  const [blackPlayer, setBlackPlayer] = useState({ nombre_usuario: 'Loading...', userELO: 1200 });
  const [loading, setLoading] = useState(true);
  const [timeLeftWhite, setTimeLeftWhite] = useState(null);
  const [timeLeftBlack, setTimeLeftBlack] = useState(null);
  const lastMoveTimeRef = useRef(null);
  /** Segundos en el último sync con servidor (snapshot al hacer el último movimiento). */
  const clockBaseWhiteRef = useRef(null);
  const clockBaseBlackRef = useRef(null);
  /** Quién debe descontar tiempo ahora ('white' | 'black'); no usar game.turn() en el intervalo. */
  const tickingColorRef = useRef(null);

  const syncClocksFromServer = (whiteSec, blackSec, ultimaJugadaEn, tickingColor) => {
    const w = coerceClockSeconds(whiteSec);
    const b = coerceClockSeconds(blackSec);
    clockBaseWhiteRef.current = w;
    clockBaseBlackRef.current = b;
    tickingColorRef.current = tickingColor;
    lastMoveTimeRef.current = ultimaJugadaEn ? new Date(ultimaJugadaEn) : new Date();
    setTimeLeftWhite(w);
    setTimeLeftBlack(b);
  };

  // Chat states
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  // Draw and Resign Custom Overlay states
  const [overlayState, setOverlayState] = useState(null); // 'confirm_resign', 'draw_offered', 'draw_sent'
  const [drawOfferFrom, setDrawOfferFrom] = useState('');

  const [wsConnected, setWsConnected] = useState(true);
  const [cancelChallengeError, setCancelChallengeError] = useState('');

  const matchRef = useRef(match);
  const userRef = useRef(user);

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Backfill user.id if session only has token (legacy login path).
  useEffect(() => {
    if (!user?.token || user?.id != null) return;

    let cancelled = false;
    api.get('/profile/me')
      .then(({ data }) => {
        if (!cancelled) updateUser(data);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [user?.token, user?.id, updateUser]);

  const wsRef = useRef(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [customSquareStyles, setCustomSquareStyles] = useState({});

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
      const newGame = new Chess();
      const moves = parseMovesFromStoredPgn(matchData.movimientos_pgn);
      for (const m of moves) newGame.move(m);
      const ticking = newGame.turn() === 'w' ? 'white' : 'black';
      syncClocksFromServer(
        matchData.tiempo_restante_blancas,
        matchData.tiempo_restante_negras,
        matchData.ultima_jugada_en,
        ticking
      );
      setGame(newGame);
      setMoveCount(moves.length);

      // Fetch player profiles to display correct names and ratings
      const modeQuery = matchData.modo ? `?modo=${matchData.modo}` : '';
      try {
        const whiteRes = await api.get(`/profile/${matchData.jugador_blancas_id}${modeQuery}`);
        setWhitePlayer(whiteRes.data);
      } catch (e) {
        setWhitePlayer({ nombre_usuario: 'White Player', userELO: 1200 });
      }

      try {
        const blackRes = await api.get(`/profile/${matchData.jugador_negras_id}${modeQuery}`);
        setBlackPlayer(blackRes.data);
      } catch (e) {
        setBlackPlayer({ nombre_usuario: 'Black Player', userELO: 1200 });
      }


      setLoading(false);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 403) {
        showToast('You are not a participant in this match.', { type: 'error' });
      } else if (err.response && err.response.status === 404) {
        showToast('Match not found.', { type: 'error' });
      } else {
        showToast('Could not load match details.');
      }
      navigate('/dashboard');
    }
  };

  useEffect(() => {
    loadGameData();
  }, [matchId]);

  // Establish WebSocket connection with auto-reconnection and heartbeat
  useEffect(() => {
    if (loading || !match) return;

    let ws = null;
    let pingInterval = null;
    let reconnectTimeout = null;
    let isDisposed = false;

    const token = localStorage.getItem('token');
    // Derive WS URL from the same base as REST. VITE_API_URL = "https://…/api" or "http://localhost:8000/api"
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    const wsBase = apiBase.replace(/^http/, 'ws').replace(/\/api$/, '');
    const wsUrl = `${wsBase}/api/match/${matchId}/ws?token=${token}`;

    const connectWebSocket = () => {
      if (isDisposed) return;
      console.log("[WebSocket] Connecting to", wsUrl);
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isDisposed) {
          ws.close();
          return;
        }
        console.log("[WebSocket] Connected successfully!");
        setWsConnected(true);

        // Fetch latest state on successful (re)connection to make sure no moves were missed
        loadGameData();

        // Start heartbeat (ping) every 25 seconds
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Handle pong message
        if (data.type === 'pong' || data.type === 'PONG') {
          // Heartbeat acknowledged
          return;
        }

        // STATE_SYNC: tablero completo tras reconexión (sin esto el cliente queda desfasado)
        if (data.type === 'state_sync' && (data.fen || data.board_state)) {
          const fen = data.fen || data.board_state;
          const syncGame = new Chess(fen);
          if (data.tiempo_restante_blancas != null) {
            const ticking = syncGame.turn() === 'w' ? 'white' : 'black';
            syncClocksFromServer(
              data.tiempo_restante_blancas,
              data.tiempo_restante_negras,
              data.ultima_jugada_en,
              ticking
            );
          }
          setGame(syncGame);
          setMoveCount(data.move_history?.length ?? 0);
          loadGameData();
          return;
        }

        if (data.type === 'move_made') {
          // Relojes ANTES de cambiar turno en pantalla (evita restar el tiempo del rival al entrar tu turno).
          if (data.tiempo_restante_blancas != null) {
            syncClocksFromServer(
              data.tiempo_restante_blancas,
              data.tiempo_restante_negras,
              data.ultima_jugada_en,
              data.turn === 'black' ? 'black' : 'white'
            );
          }

          const newGame = new Chess(data.board_state);
          setGame(newGame);
          setMoveCount(c => c + 1);
          
          // Update match state
          setMatch(prev => ({
            ...prev,
            estado: data.match_status,
            resultado: data.resultado,
            ganador_id: data.winner_id,
            movimientos_pgn: data.movimientos_pgn,
            tiempo_restante_blancas: data.tiempo_restante_blancas,
            tiempo_restante_negras: data.tiempo_restante_negras,
            ultima_jugada_en: data.ultima_jugada_en
          }));

          if (data.match_status === 'finished') {
            const color = getPlayerColor(userRef.current?.id, matchRef.current);
            const eloDiff = color === 'white' ? data.eloChangePlayerWhite : data.eloChangePlayerBlack;
            const endReason = data.end_reason
              || (data.is_checkmate ? 'checkmate' : data.is_draw ? 'draw' : null);

            setTimeout(() => {
              navigate('/result', {
                state: {
                  matchData: {
                    resultado: data.resultado,
                    color_usuario: color === 'white' ? 'white' : 'black',
                    end_reason: endReason,
                  },
                  eloDiff,
                },
              });
            }, 1500);
          }
        } else if (data.type === 'match_started') {
          if (data.board_state) {
            setGame(new Chess(data.board_state));
            setMoveCount(0);
          }
          if (data.tiempo_restante_blancas != null) {
            syncClocksFromServer(
              data.tiempo_restante_blancas,
              data.tiempo_restante_negras,
              data.ultima_jugada_en || new Date().toISOString(),
              data.turn === 'black' ? 'black' : 'white'
            );
          }
          setMatch(prev => prev ? {
            ...prev,
            estado: data.match_status || 'in_progress',
            tiempo_restante_blancas: data.tiempo_restante_blancas,
            tiempo_restante_negras: data.tiempo_restante_negras,
            ultima_jugada_en: data.ultima_jugada_en,
          } : prev);
          loadGameData();
        } else if (data.type === 'match_cancelled') {
          showToast('The challenge was cancelled or declined.', { type: 'info' });
          navigate('/friends');
        } else if (data.type === 'match_ended') {
          // Handle resignation/draw agreement
          const color = getPlayerColor(userRef.current?.id, matchRef.current);
          const eloDiff = color === 'white' ? data.eloChangePlayerWhite : data.eloChangePlayerBlack;
          
          navigate('/result', {
            state: {
              matchData: {
                resultado: data.resultado,
                color_usuario: color === 'white' ? 'white' : 'black',
                end_reason: data.end_reason || data.reason,
              },
              eloDiff,
            },
          });
        } else if (data.type === 'draw_offer') {
          if (data.offered_by !== (userRef.current?.nombre_usuario || userRef.current?.username)) {
            setDrawOfferFrom(data.offered_by);
            setOverlayState('draw_offered');
          }
        } else if (data.type === 'draw_declined') {
          if (data.declined_by !== (userRef.current?.nombre_usuario || userRef.current?.username)) {
            showToast(`Your draw offer was declined by ${data.declined_by}.`, { type: 'info' });
            setOverlayState(null);
          }
        } else if (data.type === 'chat') {
          setMessages(prev => [...prev, { username: data.username, message: data.message }]);
        }
      };

      ws.onclose = (event) => {
        if (isDisposed) return;
        console.warn("[WebSocket] Connection closed", event);
        setWsConnected(false);
        if (pingInterval) clearInterval(pingInterval);
        
        // Schedule reconnection
        reconnectTimeout = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = (err) => {
        console.error("[WebSocket] Error occurred, closing socket...", err);
        ws.close();
      };
    };

    connectWebSocket();

    return () => {
      isDisposed = true;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    };
  }, [loading, matchId]);

  // Countdown: solo el color en tickingColorRef (sincronizado con el servidor), nunca game.turn().
  useEffect(() => {
    if (!match || match.estado !== 'in_progress') return;

    const interval = setInterval(() => {
      if (!lastMoveTimeRef.current || !tickingColorRef.current) return;
      if (clockBaseWhiteRef.current == null || clockBaseBlackRef.current == null) return;

      const elapsed = (Date.now() - lastMoveTimeRef.current.getTime()) / 1000;
      const ticking = tickingColorRef.current;
      const baseW = Number(clockBaseWhiteRef.current);
      const baseB = Number(clockBaseBlackRef.current);

      if (ticking === 'white') {
        setTimeLeftWhite(Math.max(0, baseW - elapsed));
        setTimeLeftBlack(baseB);
      } else {
        setTimeLeftBlack(Math.max(0, baseB - elapsed));
        setTimeLeftWhite(baseW);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [match]);

  // Helper to execute and commit move to server
  const executeMove = async (source, target) => {
    if (!match || match.estado !== 'in_progress') return false;

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
      
      const newGame = new Chess(response.data.board_state);
      setGame(newGame);

      if (response.data.is_checkmate || response.data.is_draw) {
        const color = getPlayerColor(user?.id, match);
        setMatch(prev => prev ? {
          ...prev,
          estado: 'finished',
          resultado: response.data.is_draw
            ? 'draw'
            : (color === 'white' ? 'white_win' : 'black_win'),
        } : prev);
      }

      return true;
    } catch (err) {
      // Revert FEN silently on error (no browser alert popups!)
      setGame(new Chess(originalFen));
      const detail = err?.response?.data?.detail;
      if (typeof detail === 'string' && detail.toLowerCase().includes('lost on time')) {
        showToast('Time expired. This game was finished by timeout.');
        loadGameData();
      }
      return false;
    }
  };

  // Handle move drop on board (drag-and-drop support)
  const onDrop = async (source, target) => {
    if (!match || match.estado !== 'in_progress') return false;

    // Prevent dragging opponent's pieces
    const piece = game.get(source);
    if (!piece) return false;

    const userColor = getPlayerColor(user?.id, match);
    if (!userColor) return false;
    if ((piece.color === 'w' && userColor === 'black') || (piece.color === 'b' && userColor === 'white')) {
      return false;
    }

    const currentTurnColor = game.turn() === 'w' ? 'white' : 'black';
    if (userColor !== currentTurnColor) return false;

    // Clear click selection if dragging
    setSelectedSquare(null);
    setCustomSquareStyles({});

    return await executeMove(source, target);
  };

  // Handle square clicks (click-to-move support with legal moves highlight)
  const onSquareClick = async (square) => {
    if (!match || match.estado !== 'in_progress') return;

    const userColor = getPlayerColor(user?.id, match);
    if (!userColor) return;
    const currentTurnColor = game.turn() === 'w' ? 'white' : 'black';

    // Only allow selecting and moving on your turn
    if (userColor !== currentTurnColor) return;

    const piece = game.get(square);

    // Case A: No square is selected yet
    if (!selectedSquare) {
      // White player can only select white pieces, Black player only black pieces
      if (piece && ((piece.color === 'w' && userColor === 'white') || (piece.color === 'b' && userColor === 'black'))) {
        setSelectedSquare(square);

        // Generate visual highlights for selected piece and its legal target moves
        const moves = game.moves({ square, verbose: true });
        const styles = {
          [square]: {
            boxShadow: 'inset 0 0 0 6px #f59e0b', // Amber selection border
            backgroundColor: 'rgba(245, 158, 11, 0.15)'
          }
        };

        moves.forEach(m => {
          const hasPiece = game.get(m.to);
          styles[m.to] = {
            background: hasPiece 
              ? 'radial-gradient(circle, transparent 60%, rgba(245, 158, 11, 0.5) 62%)' // ring highlight for capture targets
              : 'radial-gradient(circle, rgba(245, 158, 11, 0.4) 25%, transparent 26%)', // dot highlight for empty move targets
            cursor: 'pointer'
          };
        });

        setCustomSquareStyles(styles);
      }
    } else {
      // Case B: A square is already selected
      if (selectedSquare === square) {
        // Clicking the same square deselects it
        setSelectedSquare(null);
        setCustomSquareStyles({});
        return;
      }

      // If user clicks another of their own pieces, change the selection highlight
      if (piece && ((piece.color === 'w' && userColor === 'white') || (piece.color === 'b' && userColor === 'black'))) {
        setSelectedSquare(square);

        const moves = game.moves({ square, verbose: true });
        const styles = {
          [square]: {
            boxShadow: 'inset 0 0 0 6px #f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.15)'
          }
        };

        moves.forEach(m => {
          const hasPiece = game.get(m.to);
          styles[m.to] = {
            background: hasPiece 
              ? 'radial-gradient(circle, transparent 60%, rgba(245, 158, 11, 0.5) 62%)'
              : 'radial-gradient(circle, rgba(245, 158, 11, 0.4) 25%, transparent 26%)',
            cursor: 'pointer'
          };
        });

        setCustomSquareStyles(styles);
        return;
      }

      // Try making the move
      const source = selectedSquare;
      const target = square;

      setSelectedSquare(null);
      setCustomSquareStyles({});

      await executeMove(source, target);
    }
  };

  // Determine if a piece is draggable (locks opponent pieces completely)
  const isDraggablePiece = ({ piece }) => {
    if (!match || match.estado !== 'in_progress') return false;

    const userColor = getPlayerColor(user?.id, match);
    if (!userColor) return false;
    const currentTurnColor = game.turn() === 'w' ? 'white' : 'black';
    
    // Only draggable on your turn
    if (userColor !== currentTurnColor) return false;

    // Resolve piece color from string ('wP', 'bN') or object
    let pieceColor = '';
    if (typeof piece === 'string') {
      pieceColor = piece[0];
    } else if (piece && piece.color) {
      pieceColor = piece.color;
    }

    // Only your own pieces are draggable
    return (pieceColor === 'w' && userColor === 'white') || (pieceColor === 'b' && userColor === 'black');
  };

  // Triggers custom resignation overlay
  const handleResign = () => {
    if (!match || match.estado !== 'in_progress') return;
    setOverlayState('confirm_resign');
  };

  // Executes resignation call to backend
  const executeResign = async () => {
    setOverlayState(null);
    try {
      await api.put(`/match/${matchId}/end`, { reason: 'resignation' });
    } catch (err) {
      console.error(err);
      showToast('Could not resign from the match.');
    }
  };

  // Triggers draw offer via WebSocket
  const handleOfferDraw = () => {
    if (!match || match.estado !== 'in_progress') return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'draw_offer' }));
      setOverlayState('draw_sent');
    }
  };

  // Accepts draw offer, calls backend to end match as draw agreement
  const handleAcceptDraw = async () => {
    setOverlayState(null);
    try {
      await api.put(`/match/${matchId}/end`, { reason: 'draw_agreement' });
    } catch (err) {
      console.error(err);
      showToast('Could not accept the draw agreement.');
    }
  };

  // Declines draw offer or cancels draw offer, sends WS event to other player
  const handleDeclineDraw = () => {
    setOverlayState(null);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'draw_declined' }));
    }
  };


  // Send chat message
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'chat', message: chatInput }));
    setChatInput('');
  };

  const hasPlayerId = user?.id != null;

  if (loading || !user || (user?.token && !hasPlayerId)) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        Entering game lobby...
      </div>
    );
  }

  const userColor = getPlayerColor(user?.id, match);
  const matchOutcome = getUserOutcome(user?.id, match);
  const matchFinished = isMatchFinished(match);
  const notationMoves = parseMovesFromStoredPgn(match?.movimientos_pgn);

  if (!userColor) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        Could not determine your side for this match.
      </div>
    );
  }
  const myTurn = !matchFinished && (
    (game.turn() === 'w' && userColor === 'white') || (game.turn() === 'b' && userColor === 'black')
  );
  
  // Arrange players (Opponent on top, Current User on bottom)
  const opponent = userColor === 'white' ? blackPlayer : whitePlayer;
  const me = userColor === 'white' ? whitePlayer : blackPlayer;

  const PlayerInfo = ({ player, color, isBottom }) => {
    const calculateCapturedPieces = (playerColor) => { const initial = { p: 8, n: 2, b: 2, r: 2, q: 1 }; const current = { p: 0, n: 0, b: 0, r: 0, q: 0 }; const board = game.board(); for (let row of board) { for (let square of row) { if (square && square.color === (playerColor === 'white' ? 'b' : 'w')) { current[square.type]++; } } } const captured = []; for (const type of ['q', 'r', 'b', 'n', 'p']) { const diff = initial[type] - current[type]; for (let i = 0; i < diff; i++) captured.push(type); } return captured; }; const isWhite = color === 'white';
    const timeLeft = isWhite ? timeLeftWhite : timeLeftBlack;
    const isPlayerTurn = game.turn() === (isWhite ? 'w' : 'b') && match.estado === 'in_progress';
    
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem', backgroundColor: 'var(--surface-color)',
        border: '1px solid var(--border-color)',
        marginBottom: isBottom ? 0 : '1rem',
        marginTop: isBottom ? '1rem' : 0,
        borderColor: isPlayerTurn ? '#f59e0b' : 'var(--border-color)',
        boxShadow: isPlayerTurn ? '0 0 10px rgba(245, 158, 11, 0.15)' : 'none',
        transition: 'all 0.15s ease'
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
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>RANK {player?.userELO || 1200}</div>{calculateCapturedPieces(color).length > 0 && <div style={{ fontSize: '16px', display: 'flex', gap: '1px', marginTop: '2px', lineHeight: 1 }}>{calculateCapturedPieces(color).map((type, i) => <span key={i} style={{ color: color === 'white' ? '#09090b' : '#f4f4f5', textShadow: color === 'white' ? '-1px -1px 0 rgba(255,255,255,0.4), 1px -1px 0 rgba(255,255,255,0.4), -1px 1px 0 rgba(255,255,255,0.4), 1px 1px 0 rgba(255,255,255,0.4)' : 'none' }}>{({ w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' }, b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' } })[color === 'white' ? 'b' : 'w'][type]}</span>)}</div>}
          </div>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '2px',
          flexShrink: 0,
        }}>
          <div
            style={{
              padding: '6px 12px',
              backgroundColor: isPlayerTurn ? '#f59e0b' : '#27272a',
              color: isPlayerTurn ? '#09090b' : '#fff',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '18px',
              fontWeight: 800,
              borderRadius: '4px',
              minWidth: '5.5ch',
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.02em',
              transition: 'all 0.15s ease',
            }}
          >
            {formatClockSeconds(timeLeft)}
          </div>
        </div>
      </div>
    );
  };

  if (match && match.estado === 'waiting') {
    const isWhite = userColor === 'white';
    const opponentName = (whitePlayer?.nombre_usuario === user?.nombre_usuario || whitePlayer?.nombre_usuario === user?.username) ? blackPlayer?.nombre_usuario : whitePlayer?.nombre_usuario;

    return (
      <div className="fade-in" style={{
        minHeight: '85vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem'
      }}>
        <div style={{
          backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)',
          padding: '4rem 3rem', maxWidth: '500px', width: '100%',
          display: 'flex', flexDirection: 'column', gap: '2rem',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <LuSwords size={48} style={{ animation: 'pulse 2s infinite' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '0.5rem' }}>Challenge Pending</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Waiting for <strong style={{ color: 'var(--text-primary)' }}>{opponentName || 'your friend'}</strong> to accept the challenge...
            </p>
          </div>

          <div style={{
            borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)',
            padding: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Challenge Configuration</div>
            <div style={{ fontSize: '18px', fontWeight: 900 }}>{match.modo.toUpperCase()} Ranked</div>
            <div style={{ fontSize: '14px', color: '#f59e0b', fontWeight: 700 }}>Time Control: {match.control_tiempo}</div>
          </div>

          {cancelChallengeError && (
            <div style={{
              padding: '12px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--error-color)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--error-color)',
            }}>
              {cancelChallengeError}
            </div>
          )}

          <button onClick={async () => {
            setCancelChallengeError('');
            try {
              await api.delete(`/match/invite/${match.id}/decline`);
              navigate('/friends');
            } catch {
              setCancelChallengeError('Could not cancel the challenge. Try again.');
            }
          }} className="secondary-btn" style={{
            padding: '12px', width: '100%', color: 'var(--error-color)',
            borderColor: 'rgba(239, 68, 68, 0.2)', fontWeight: 700
          }}>
            Cancel Challenge
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '1200px', margin: '0 auto', padding: '2rem',
      display: 'grid', gridTemplateColumns: 'minmax(400px, 600px) 1fr', gap: '3rem',
      position: 'relative'
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .pulse {
          animation: pulse 1.5s infinite;
        }
        .spin {
          animation: spin 1.2s linear infinite;
        }
      `}</style>
      
      {overlayState && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(9, 9, 11, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div style={{
            backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)',
            padding: '2.5rem', maxWidth: '400px', width: '100%', textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: '1.5rem'
          }}>
            {overlayState === 'confirm_resign' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--error-color)' }}>
                  <LuFlag size={40} />
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '0.5rem' }}>Resign Match?</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>You will lose ELO rating points immediately.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button onClick={() => setOverlayState(null)} className="secondary-btn" style={{ padding: '10px' }}>Cancel</button>
                  <button onClick={executeResign} className="primary-btn" style={{ padding: '10px', backgroundColor: 'var(--error-color)', borderColor: 'var(--error-color)', color: '#fff' }}>Resign</button>
                </div>
              </>
            )}
            {overlayState === 'draw_offered' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-primary)' }}>
                  <LuHandshake size={40} />
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '0.5rem' }}>Draw Offered</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{drawOfferFrom}</strong> has offered a draw agreement.
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button onClick={handleDeclineDraw} className="secondary-btn" style={{ padding: '10px', color: 'var(--error-color)' }}>Decline</button>
                  <button onClick={handleAcceptDraw} className="primary-btn" style={{ padding: '10px' }}>Accept</button>
                </div>
              </>
            )}
            {overlayState === 'draw_sent' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  <LuClock size={40} style={{ animation: 'pulse 1.5s infinite' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '0.5rem' }}>Draw Offer Sent</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Waiting for opponent to accept or decline the offer...</p>
                </div>
                <button onClick={handleDeclineDraw} className="secondary-btn" style={{ padding: '10px', color: 'var(--error-color)' }}>Cancel Offer</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Chessboard Area */}
      <div>
        <PlayerInfo player={opponent} color={userColor === 'white' ? 'black' : 'white'} />
        
        <div style={{ 
          border: '1px solid var(--border-color)', 
          padding: '10px', 
          backgroundColor: '#18181b',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
        }}>
          <Chessboard 
            position={game.fen()} 
            onPieceDrop={onDrop}
            onSquareClick={onSquareClick}
            customSquareStyles={customSquareStyles}
            boardOrientation={userColor}
            isDraggablePiece={isDraggablePiece}
            customDarkSquareStyle={{ backgroundColor: '#09090b' }}
            customLightSquareStyle={{ backgroundColor: '#27272a' }}
            customBoardStyle={{ borderRadius: '0px' }}
          />
        </div>

        <PlayerInfo player={me} color={userColor} isBottom />
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
            {matchOutcome ? (
              <span style={{
                color: matchOutcome === 'Victory'
                  ? 'var(--success-color)'
                  : matchOutcome === 'Defeat'
                    ? 'var(--error-color)'
                    : '#f59e0b',
              }}>
                {matchOutcome.toUpperCase()}
              </span>
            ) : (
              <span style={{ color: myTurn ? 'var(--success-color)' : 'var(--text-secondary)' }}>
                {myTurn ? 'YOUR TURN' : "OPPONENT'S TURN"}
              </span>
            )}
          </div>
          {!wsConnected && (
            <div className="pulse" style={{
              marginTop: '12px',
              padding: '8px 12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--error-color)',
              color: 'var(--error-color)',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <LuLoader size={14} className="spin" />
              Reconnecting to game server...
            </div>
          )}
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
            {notationMoves.length === 0 ? 'Awaiting initial opening...' : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {notationMoves.reduce((acc, move, idx) => {
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
            onClick={handleOfferDraw}
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
