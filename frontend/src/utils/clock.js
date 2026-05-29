/**
 * Formato de reloj de ajedrez: solo segundos totales → MM:SS (o H:MM:SS).
 * Nunca mezclar con control_tiempo ("3+2"); eso producía "310:00" (= "3" + "10:00").
 */

export function coerceClockSeconds(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+:\d{2}(:\d{2})?$/.test(trimmed)) {
      const parts = trimmed.split(':').map((p) => parseInt(p, 10));
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    const n = Number(trimmed);
    return Number.isFinite(n) ? Math.max(0, n) : null;
  }
  return null;
}

export function formatClockSeconds(totalSeconds) {
  const s = coerceClockSeconds(totalSeconds);
  if (s == null) return '--:--';

  const whole = Math.floor(s);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const sec = whole % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}
