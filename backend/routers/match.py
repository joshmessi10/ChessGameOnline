import asyncio

from fastapi import APIRouter, Depends, status, WebSocket, WebSocketDisconnect
from sqlmodel import Session

from ..core.dependencies import CurrentUserDep, SessionDep
from ..core.websocket_manager import websocket_manager
from ..database import get_session
from ..realtime.event_router import event_router
from ..realtime.game_service import RealtimeGameService
from ..realtime.logging_util import log_realtime
from ..schemas.invite import InviteRequest, InviteResponse
from ..schemas.match import (
    EndMatchRequest,
    EndMatchResponse,
    MatchResponse,
    MoveRequest,
    MoveResponse,
)
from ..services.match_service import MatchService

router = APIRouter(prefix="/api/match", tags=["match"])


@router.get("/invite/pending")
async def get_pending_invites(session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    return service.get_pending_invites(current_user.id)


@router.get("/invite/sent")
async def get_sent_invites(session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    return service.get_sent_invites(current_user.id)


@router.get("/active")
async def get_my_active_matches(session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    return service.get_active_matches_for_player(current_user.id)


@router.get("/{matchID}", response_model=MatchResponse)
async def get_match(matchID: str, session: SessionDep, current_user: CurrentUserDep):
    service = MatchService(session)
    return service.get_match(matchID, current_user.id)


@router.post("/{matchID}/move", response_model=MoveResponse)
async def make_move(
    matchID: str, request: MoveRequest, session: SessionDep, current_user: CurrentUserDep
):
    service = MatchService(session)
    result = service.make_move(matchID, current_user.id, request)
    await RealtimeGameService.apply_http_move_side_effects(
        matchID, result["broadcast_payload"]
    )
    return result["response"]


@router.put("/{matchID}/end", response_model=EndMatchResponse)
async def end_match(
    matchID: str,
    request: EndMatchRequest,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    service = MatchService(session)
    result = service.end_match(matchID, current_user.id, request)
    await RealtimeGameService.apply_http_match_end_side_effects(
        matchID, result["broadcast_payload"]
    )
    return result["response"]


@router.post("/invite", response_model=InviteResponse)
async def send_invite(
    request: InviteRequest, session: SessionDep, current_user: CurrentUserDep
):
    service = MatchService(session)
    return service.send_invite(current_user.id, request)


@router.put("/invite/{inviteID}/accept")
async def accept_invite(
    inviteID: str, session: SessionDep, current_user: CurrentUserDep
):
    service = MatchService(session)
    result = service.join_match(inviteID, current_user.id)
    rt = RealtimeGameService(session)
    await rt.apply_http_match_started_side_effects(
        str(inviteID), result["broadcast_payload"]
    )
    return result["response"]


@router.delete("/invite/{inviteID}/decline")
async def decline_invite(
    inviteID: str, session: SessionDep, current_user: CurrentUserDep
):
    service = MatchService(session)
    result = service.decline_invite(inviteID, current_user.id)
    await websocket_manager.broadcast_to_match(
        str(inviteID), result["broadcast_payload"]
    )
    return result["response"]


@router.websocket("/{matchID}/ws")
async def match_websocket(
    websocket: WebSocket, matchID: str, session: Session = Depends(get_session)
):
    """Endpoint WebSocket delgado: autenticación + bucle → `event_router` (capa 2)."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        from jose import jwt

        from ..config import settings
        from ..repositories.match_repository import MatchRepository
        from ..repositories.usuario_repository import UsuarioRepository

        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")
        user_repo = UsuarioRepository(session)
        user = user_repo.find_by_username(username)
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    match_repo = MatchRepository(session)
    match_obj = match_repo.find_by_id(matchID)
    if not match_obj or (
        user.id != match_obj.jugador_blancas_id
        and user.id != match_obj.jugador_negras_id
    ):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = str(user.id)
    is_reconnect = await websocket_manager.connect(matchID, user_id, websocket)

    await event_router.on_player_connected(
        match_id=matchID,
        user_id=user_id,
        websocket=websocket,
        session=session,
        is_reconnect=is_reconnect,
    )

    # Cliente puede enviar JOIN explícito; STATE_SYNC ya se envió al conectar.
    try:
        while True:
            data = await websocket.receive_text()
            await event_router.route(
                match_id=matchID,
                user_id=user_id,
                username=user.nombre_usuario,
                websocket=websocket,
                raw_text=data,
                session=session,
            )
    except WebSocketDisconnect:
        websocket_manager.disconnect(matchID, user_id)
        log_realtime(matchID, user_id, "DISCONNECT", "Client closed WebSocket")
    except Exception as e:
        import traceback
        traceback.print_exc()
        websocket_manager.disconnect(matchID, user_id)
        log_realtime(matchID, user_id, "ERROR", f"WebSocket exception: {type(e).__name__}: {e}")
