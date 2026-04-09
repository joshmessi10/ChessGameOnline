from typing import List
from fastapi import APIRouter, Depends, status
from ..schemas.friendship import FriendResponse, FriendshipDTO
from ..services.friendship_service import FriendshipService
from ..core.dependencies import SessionDep, CurrentUserDep

router = APIRouter(prefix="/api/friends", tags=["friends"])

@router.get("", response_model=List[FriendshipDTO])
async def list_friends(session: SessionDep, current_user: CurrentUserDep):
    service = FriendshipService(session)
    return service.list_friends(current_user.id)

@router.post("/request", response_model=FriendResponse)
async def send_friend_request(targetID: int, session: SessionDep, current_user: CurrentUserDep):
    service = FriendshipService(session)
    return service.send_request(current_user.id, targetID)

@router.put("/{targetID}/accept", response_model=FriendResponse)
async def accept_friend_request(targetID: int, session: SessionDep, current_user: CurrentUserDep):
    service = FriendshipService(session)
    return service.accept_request(current_user.id, targetID)

@router.delete("/{targetID}/reject")
async def reject_friend_request(targetID: int, session: SessionDep, current_user: CurrentUserDep):
    service = FriendshipService(session)
    service.reject_request(current_user.id, targetID)
    return {"message": "Request rejected"}

@router.delete("/{targetID}")
async def remove_friend(targetID: int, session: SessionDep, current_user: CurrentUserDep):
    service = FriendshipService(session)
    service.remove_friend(current_user.id, targetID)
    return {"message": "Friend removed"}
