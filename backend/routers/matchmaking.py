from fastapi import APIRouter, Depends
from ..schemas.matchmaking import QueueRequest, QueueResponse
from ..services.matchmaking_service import MatchmakingService
from ..core.dependencies import SessionDep, CurrentUserDep

router = APIRouter(prefix="/api/matchmaking", tags=["matchmaking"])

@router.post("/join", response_model=QueueResponse)
async def join_queue(request: QueueRequest, session: SessionDep, current_user: CurrentUserDep):
    service = MatchmakingService(session)
    return service.join_queue(current_user.id, request)

@router.delete("/leave", response_model=QueueResponse)
async def leave_queue(session: SessionDep, current_user: CurrentUserDep):
    service = MatchmakingService(session)
    return service.leave_queue(current_user.id)

@router.get("/status")
async def get_status(current_user: CurrentUserDep):
    return {"status": "searching", "user_id": current_user.id}
