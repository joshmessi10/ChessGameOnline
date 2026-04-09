from typing import Dict, List, Optional
from sqlmodel import Session
from ..models.enums import MatchType
from ..schemas.matchmaking import QueueRequest, QueueResponse

class MatchmakingService:
    # In a real app, this would use Redis or an in-memory queue
    _queues: Dict[MatchType, List[int]] = {
        MatchType.BULLET: [],
        MatchType.BLITZ: [],
        MatchType.RAPID: [],
        MatchType.CLASSICAL: []
    }

    def __init__(self, session: Session):
        self.session = session

    def join_queue(self, user_id: int, request: QueueRequest) -> QueueResponse:
        queue = self._queues.get(request.modo)
        if user_id not in queue:
            queue.append(user_id)
            
        return QueueResponse(
            status="queued",
            message=f"Added to {request.modo} queue",
            estimated_wait_time=15
        )

    def leave_queue(self, user_id: int) -> QueueResponse:
        for mode in self._queues:
            if user_id in self._queues[mode]:
                self._queues[mode].remove(user_id)
                
        return QueueResponse(
            status="removed",
            message="Removed from all queues",
            estimated_wait_time=0
        )

    def check_match(self, user_id: int) -> Optional[int]:
        # Simple logic: if there are 2 or more players, return a match (mock)
        return None
        
    def try_match_players(self, mode: MatchType) -> Optional[Dict]:
        queue = self._queues.get(mode)
        if len(queue) >= 2:
            p1 = queue.pop(0)
            p2 = queue.pop(0)
            return {"white_id": p1, "black_id": p2, "mode": mode}
        return None
