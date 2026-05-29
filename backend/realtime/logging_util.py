"""Logs estructurados para observabilidad básica del canal en tiempo real."""

import logging

logger = logging.getLogger("chess.realtime")


def log_realtime(
    match_id: str,
    user_id: str,
    event_type: str,
    message: str,
    level: int = logging.INFO,
) -> None:
    """Formato: [match_id][user_id][event_type] mensaje."""
    logger.log(level, "[%s][%s][%s] %s", match_id, user_id, event_type, message)
