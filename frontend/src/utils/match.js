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
