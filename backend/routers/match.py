from fastapi import APIRouter, Depends, status
from ..schemas.match import MatchResponse, MoveRequest, MoveResponse, EndMatchRequest, EndMatchResponse
from ..schemas.invite import InviteRequest, InviteResponse
from ..services.match_service import MatchService
from ..core.dependencies import SessionDep, CurrentUserDep

router = APIRouter(prefix="/api/match", tags=["match"])

@router.get("/{matchID}", response_model=MatchResponse)
async def get_match(matchID: int, session: SessionDep):
    service = MatchService(session)
    return service.get_match(matchID)

@router.post("/{matchID}/move", response_model=MoveResponse)
async def make_move(matchID: int, request: MoveRequest, session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    return service.make_move(matchID, current_user.id, request)

@router.put("/{matchID}/end", response_model=EndMatchResponse)
async def end_match(matchID: int, request: EndMatchRequest, session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    return service.end_match(matchID, current_user.id, request)

@router.post("/invite", response_model=InviteResponse)
async def send_invite(request: InviteRequest, session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    return service.send_invite(current_user.id, request)

@router.put("/invite/{inviteID}/accept")
async def accept_invite(inviteID: int, session: SessionDep, current_user: CurrentUserDep):
    # This would call join_match or similar
    service = MatchService(session)
    return service.join_match(inviteID, current_user.id)

@router.delete("/invite/{inviteID}/decline")
async def decline_invite(inviteID: int):
    return {"message": "Invite declined"}
