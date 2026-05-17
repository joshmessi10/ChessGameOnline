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

async def get_match(matchID: int, session: SessionDep):
    service = MatchService(session)
    return service.get_match(matchID)

@router.post("/{matchID}/move", response_model=MoveResponse)
async def make_move(matchID: int, request: MoveRequest, session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    from ..repositories.rating_repository import RatingRepository
    rating_repo = RatingRepository(session)
    match_preview = service.match_repo.find_by_id(matchID)
    old_elo_w = 1200
    old_elo_b = 1200
    if match_preview:
        rw_old = rating_repo.find_by_usuario_and_modo(match_preview.jugador_blancas_id, match_preview.modo)
        rb_old = rating_repo.find_by_usuario_and_modo(match_preview.jugador_negras_id, match_preview.modo)
        old_elo_w = rw_old.rating if rw_old else 1200
        old_elo_b = rb_old.rating if rb_old else 1200

    response = service.make_move(matchID, current_user.id, request)
    
    # Broadcast move to both players in real time
    fen_parts = response.board_state.split()
    next_turn = "white" if len(fen_parts) > 1 and fen_parts[1] == "w" else "black"
    
    match = service.match_repo.find_by_id(matchID)
    
    new_elo_w = None
    new_elo_b = None
    change_w = 0
    change_b = 0
    from ..models.enums import MatchStatus
    if match.estado == MatchStatus.FINISHED:
        rw_obj = rating_repo.find_by_usuario_and_modo(match.jugador_blancas_id, match.modo)
        rb_obj = rating_repo.find_by_usuario_and_modo(match.jugador_negras_id, match.modo)
        new_elo_w = rw_obj.rating if rw_obj else 1200
        new_elo_b = rb_obj.rating if rb_obj else 1200
        change_w = new_elo_w - old_elo_w
        change_b = new_elo_b - old_elo_b
    
    await websocket_manager.broadcast_to_match(matchID, {
        "type": "move_made",
        "move": response.move,
        "board_state": response.board_state,
        "is_checkmate": response.is_checkmate,
        "is_draw": response.is_draw,
        "turn": next_turn,
        "match_status": match.estado,
        "winner_id": match.ganador_id,
        "resultado": match.resultado,
        "movimientos_pgn": match.movimientos_pgn,
        "newELOPlayerWhite": new_elo_w,
        "newELOPlayerBlack": new_elo_b,
        "eloChangePlayerWhite": change_w,
        "eloChangePlayerBlack": change_b
    })

    
    return response

@router.put("/{matchID}/end", response_model=EndMatchResponse)
async def end_match(matchID: int, request: EndMatchRequest, session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    response = service.end_match(matchID, current_user.id, request)
    
    # Broadcast match_ended to both players in real time
    match = service.match_repo.find_by_id(matchID)
    await websocket_manager.broadcast_to_match(matchID, {
        "type": "match_ended",
        "reason": request.reason,
        "winner_id": match.ganador_id if match else None,
        "resultado": match.resultado if match else response.result,
        "newELOPlayerWhite": response.newELOPlayerWhite,
        "newELOPlayerBlack": response.newELOPlayerBlack,
        "eloChangePlayerWhite": response.eloChangePlayerWhite,
        "eloChangePlayerBlack": response.eloChangePlayerBlack
    })
    
    return response


@router.post("/invite", response_model=InviteResponse)
async def send_invite(request: InviteRequest, session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    return service.send_invite(current_user.id, request)

@router.put("/invite/{inviteID}/accept")
async def accept_invite(inviteID: int, session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    res = service.join_match(inviteID, current_user.id)
    await websocket_manager.broadcast_to_match(inviteID, {
        "type": "match_started",
        "match_id": inviteID,
        "board_state": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "turn": "white",
        "match_status": "in_progress"
    })
    return res

@router.delete("/invite/{inviteID}/decline")
async def decline_invite(inviteID: int, session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    res = service.decline_invite(inviteID, current_user.id)
    await websocket_manager.broadcast_to_match(inviteID, {
        "type": "match_cancelled",
        "match_id": inviteID,
        "message": "Challenge declined"
    })
    return res


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
        
    await websocket_manager.connect(matchID, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            import json
            try:
                msg = json.loads(data)
                if msg.get("type") == "chat":
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

    except WebSocketDisconnect:
        websocket_manager.disconnect(matchID, websocket)
