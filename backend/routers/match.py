from fastapi import APIRouter, Depends, status, WebSocket, WebSocketDisconnect
from sqlmodel import Session
from ..schemas.match import MatchResponse, MoveRequest, MoveResponse, EndMatchRequest, EndMatchResponse
from ..schemas.invite import InviteRequest, InviteResponse
from ..services.match_service import MatchService
from ..core.dependencies import SessionDep, CurrentUserDep
from ..core.websocket_manager import websocket_manager
from ..database import get_session

router = APIRouter(prefix="/api/match", tags=["match"])

@router.get("/invite/pending")
async def get_pending_invites(session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    return service.get_pending_invites(current_user.id)

@router.get("/active")
async def get_my_active_matches(session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    return service.get_active_matches_for_player(current_user.id)

@router.get("/{matchID}", response_model=MatchResponse)
async def get_match(matchID: int, session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    return service.get_match(matchID, current_user.id)

@router.post("/{matchID}/move", response_model=MoveResponse)
async def make_move(matchID: int, request: MoveRequest, session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    
    result = service.make_move(matchID, current_user.id, request)
    
    # Broadcast move to both players in real time
    await websocket_manager.broadcast_to_match(matchID, result["broadcast_payload"])
    
    return result["response"]

@router.put("/{matchID}/end", response_model=EndMatchResponse)
async def end_match(matchID: int, request: EndMatchRequest, session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    result = service.end_match(matchID, current_user.id, request)
    
    # Broadcast match_ended to both players in real time
    await websocket_manager.broadcast_to_match(matchID, result["broadcast_payload"])
    
    return result["response"]


@router.post("/invite", response_model=InviteResponse)
async def send_invite(request: InviteRequest, session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    return service.send_invite(current_user.id, request)

@router.put("/invite/{inviteID}/accept")
async def accept_invite(inviteID: int, session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    result = service.join_match(inviteID, current_user.id)
    
    # Broadcast match_started to both players in real time
    await websocket_manager.broadcast_to_match(inviteID, result["broadcast_payload"])
    
    return result["response"]

@router.delete("/invite/{inviteID}/decline")
async def decline_invite(inviteID: int, session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    result = service.decline_invite(inviteID, current_user.id)
    
    # Broadcast match_cancelled to both players in real time
    await websocket_manager.broadcast_to_match(inviteID, result["broadcast_payload"])
    
    return result["response"]


@router.websocket("/{matchID}/ws")
async def match_websocket(websocket: WebSocket, matchID: int, session: Session = Depends(get_session)):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    try:
        from jose import jwt
        from ..config import settings
        from ..repositories.usuario_repository import UsuarioRepository
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        user_repo = UsuarioRepository(session)
        user = user_repo.find_by_username(username)
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    # Check if the user is a participant in the match
    from ..repositories.match_repository import MatchRepository
    match_repo = MatchRepository(session)
    match_obj = match_repo.find_by_id(matchID)
    if not match_obj or (user.id != match_obj.jugador_blancas_id and user.id != match_obj.jugador_negras_id):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    import asyncio
    await websocket_manager.connect(matchID, websocket)
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=1.0)
                import json
                try:
                    msg = json.loads(data)
                    if msg.get("type") == "ping":
                        await websocket.send_json({"type": "pong"})
                    elif msg.get("type") == "chat":
                        await websocket_manager.broadcast_to_match(matchID, {
                            "type": "chat",
                            "username": user.nombre_usuario,
                            "message": msg.get("message")
                        })
                    elif msg.get("type") == "draw_offer":
                        await websocket_manager.broadcast_to_match(matchID, {
                            "type": "draw_offer",
                            "offered_by": user.nombre_usuario
                        })
                    elif msg.get("type") == "draw_declined":
                        await websocket_manager.broadcast_to_match(matchID, {
                            "type": "draw_declined",
                            "declined_by": user.nombre_usuario
                        })
                except Exception:
                    pass
            except asyncio.TimeoutError:
                # Check for chess match time limits
                from ..services.match_service import MatchService
                service = MatchService(session)
                timeout_payload = service.check_and_apply_timeout(matchID)
                if timeout_payload:
                    await websocket_manager.broadcast_to_match(matchID, timeout_payload)
                    
    except WebSocketDisconnect:
        websocket_manager.disconnect(matchID, websocket)
