from typing import Dict, List, Optional
from sqlmodel import Session
from ..models.enums import MatchType
from ..schemas.matchmaking import QueueRequest, QueueResponse

class MatchmakingService:
    # Rich queues containing dictionary objects: { "user_id": int, "rating": int, "joined_at": datetime }
    _queues: Dict[MatchType, List[dict]] = {
        MatchType.BULLET: [],
        MatchType.BLITZ: [],
        MatchType.RAPID: [],
        MatchType.CLASSICAL: []
    }
    
    # Store resolved matches: user_id -> match_id
    _matches: Dict[int, str] = {}

    def __init__(self, session: Session):
        self.session = session

    def join_queue(self, user_id: int, request: QueueRequest) -> QueueResponse:
        # Check if already queued anywhere
        for mode in self._queues:
            if any(player["user_id"] == user_id for player in self._queues[mode]):
                return QueueResponse(
                    status="already_queued",
                    message="Already in matchmaking queue",
                    estimated_wait_time=5
                )

        # Get user rating for this mode
        from ..repositories.rating_repository import RatingRepository
        rating_repo = RatingRepository(self.session)
        rating_obj = rating_repo.find_by_usuario_and_modo(user_id, request.modo)
        rating = rating_obj.rating if rating_obj else 1200

        from datetime import datetime, timezone
        self._queues[request.modo].append({
            "user_id": user_id,
            "rating": rating,
            "joined_at": datetime.now(timezone.utc)
        })
            
        return QueueResponse(
            status="queued",
            message=f"Added to {request.modo.value} queue",
            estimated_wait_time=15
        )

    def leave_queue(self, user_id: int) -> QueueResponse:
        for mode in self._queues:
            self._queues[mode] = [p for p in self._queues[mode] if p["user_id"] != user_id]
                
        return QueueResponse(
            status="removed",
            message="Removed from all queues",
            estimated_wait_time=0
        )

    def get_status(self, user_id: int) -> dict:
        if user_id in self._matches:
            match_id = self._matches.pop(user_id)
            return {"status": "matched", "matchID": match_id}

        is_searching = False
        for mode in self._queues:
            for p in self._queues[mode]:
                if p["user_id"] == user_id:
                    from datetime import datetime, timezone
                    wait_time = (datetime.now(timezone.utc) - p["joined_at"]).total_seconds()
                    if wait_time >= 300:
                        self._queues[mode].remove(p)
                        return {
                            "status": "timeout", 
                            "message": "You have been removed from the queue because there are no available players at the moment."
                        }
                    is_searching = True
                    break
            if is_searching:
                break

        if is_searching:
            return {"status": "searching"}
        return {"status": "idle"}
        
    def try_match_players(self, mode: MatchType) -> Optional[dict]:
        queue = self._queues.get(mode)
        if len(queue) < 2:
            return None

        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)

        for i in range(len(queue)):
            p1 = queue[i]
            wait_time_1 = (now - p1["joined_at"]).total_seconds()
            # ELO tolerance starts at 100 and expands by 50 every 5 seconds of wait time
            elo_tolerance_1 = 100 + 50 * int(wait_time_1 / 5)

            for j in range(i + 1, len(queue)):
                p2 = queue[j]
                wait_time_2 = (now - p2["joined_at"]).total_seconds()
                elo_tolerance_2 = 100 + 50 * int(wait_time_2 / 5)

                rating_diff = abs(p1["rating"] - p2["rating"])
                max_tolerance = max(elo_tolerance_1, elo_tolerance_2)

                if rating_diff <= max_tolerance:
                    # Pop from queue (j first since it is higher index)
                    queue.pop(j)
                    queue.pop(i)

                    import random
                    if random.choice([True, False]):
                        white_id, black_id = p1["user_id"], p2["user_id"]
                    else:
                        white_id, black_id = p2["user_id"], p1["user_id"]

                    # Default time configurations per mode
                    control_tiempo = "10+0"
                    if mode == MatchType.BULLET:
                        control_tiempo = "1+0"
                    elif mode == MatchType.BLITZ:
                        control_tiempo = "3+2"
                    elif mode == MatchType.RAPID:
                        control_tiempo = "10+0"
                    elif mode == MatchType.CLASSICAL:
                        control_tiempo = "30+0"

                    from ..models.match import Match
                    from ..models.enums import MatchStatus, MatchResult
                    from ..repositories.match_repository import MatchRepository
                    from datetime import datetime, timezone

                    match_repo = MatchRepository(self.session)
                    # Keep parser behavior aligned with MatchService for legacy controls like "300+0"
                    base_part = control_tiempo.split("+")[0] if "+" in control_tiempo else control_tiempo
                    base = int(base_part)
                    initial_seconds = base if base >= 180 else base * 60
                    new_match = Match(
                        jugador_blancas_id=white_id,
                        jugador_negras_id=black_id,
                        modo=mode,
                        control_tiempo=control_tiempo,
                        estado=MatchStatus.IN_PROGRESS,
                        resultado=MatchResult.ONGOING,
                        tiempo_restante_blancas=float(initial_seconds),
                        tiempo_restante_negras=float(initial_seconds),
                        ultima_jugada_en=datetime.now(timezone.utc),
                    )
                    saved = match_repo.save(new_match)

                    # Save resolution mappings
                    self._matches[p1["user_id"]] = saved.id
                    self._matches[p2["user_id"]] = saved.id

                    return {
                        "match_id": saved.id,
                        "white_id": white_id,
                        "black_id": black_id,
                        "mode": mode
                    }
        return None
