import React, { useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

const ChessBoard = ({ matchId, initialFen = 'start' }) => {
  const [game, setGame] = useState(new Chess(initialFen === 'start' ? undefined : initialFen));

  function makeAMove(move) {
    try {
      const result = game.move(move);
      setGame(new Chess(game.fen()));
      return result;
    } catch (e) {
      return null;
    }
  }

  function onDrop(sourceSquare, targetSquare) {
    const move = makeAMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q', // always promote to queen for simplicity
    });

    if (move === null) return false;
    
    // Here logic to send move to backend in the future
    console.log(`Move made: ${move.san}`);
    return true;
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: '600px',
      margin: '0 auto',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      <Chessboard 
        position={game.fen()} 
        onPieceDrop={onDrop} 
        boardOrientation="white"
      />
      <div className="glass-panel" style={{ marginTop: '16px', padding: '12px' }}>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          PGN: {game.pgn() || 'Waiting for first move...'}
        </p>
      </div>
    </div>
  );
};

export default ChessBoard;
