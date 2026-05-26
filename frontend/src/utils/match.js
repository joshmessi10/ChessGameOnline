/** Resolve the authenticated user's color for a match, or null if unknown. */
export function getPlayerColor(userId, match) {
  if (!match || userId == null || userId === '') return null;

  const uid = Number(userId);
  if (Number.isNaN(uid)) return null;

  const whiteId = Number(match.jugador_blancas_id);
  const blackId = Number(match.jugador_negras_id);

  if (uid === whiteId) return 'white';
  if (uid === blackId) return 'black';
  return null;
}

export function isMatchFinished(match) {
  if (!match) return false;
  if (match.estado === 'finished') return true;
  const r = match.resultado;
  return r && r !== 'ongoing';
}

export function getUserOutcome(userId, match) {
  if (!isMatchFinished(match)) return null;

  const color = getPlayerColor(userId, match);
  if (!color) return null;

  const result = match.resultado;
  if (result === 'draw') return 'Draw';

  const userWon =
    (color === 'white' && result === 'white_win') ||
    (color === 'black' && result === 'black_win');

  return userWon ? 'Victory' : 'Defeat';
}

const END_REASON_LABELS = {
  checkmate: 'Checkmate',
  resignation: 'Resignation',
  timeout: 'Timeout',
  stalemate: 'Stalemate',
  draw: 'Draw',
  draw_agreement: 'Draw by agreement',
};

export function formatEndReason(endReason) {
  if (!endReason) return 'Game over';
  return END_REASON_LABELS[endReason] || 'Game over';
}
