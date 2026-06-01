import pytest
from fastapi import HTTPException
from sqlmodel import Session
from backend.services.user_service import UserService
from backend.services.friendship_service import FriendshipService
from backend.services.match_service import MatchService
from backend.models.enums import FriendshipStatus, MatchStatus, MatchType
from backend.schemas.invite import InviteRequest

def test_search_users(db: Session, make_user):
    user1 = make_user(db, username="LeonardoChess")
    user2 = make_user(db, username="Leo123")
    user3 = make_user(db, username="OtherPlayer")
    searcher = make_user(db, username="Searcher")

    service = UserService(db)
    
    # 3.1.1, 3.1.4, 3.1.5 - Search with partial match
    res = service.search_users("Leo", searcher.id)
    usernames = [r.nombre_usuario for r in res.results]
    assert "LeonardoChess" in usernames
    assert "Leo123" in usernames

    # 3.1.2 - No results
    res = service.search_users("inexistente_xyz_123", searcher.id)
    assert len(res.results) == 0

def test_friendship_flow(db: Session, make_user):
    user_a = make_user(db, username="user_a")
    user_b = make_user(db, username="user_b")

    service = FriendshipService(db)

    # 3.2.1 - Send request
    req = service.send_request(user_a.id, user_b.id)
    assert req.estado == FriendshipStatus.PENDING

    # 3.2.2 - Duplicate request
    with pytest.raises(HTTPException) as exc:
        service.send_request(user_a.id, user_b.id)
    assert exc.value.status_code == 400

    # 3.2.3 - Send request to self
    with pytest.raises(HTTPException) as exc:
        service.send_request(user_a.id, user_a.id)
    assert exc.value.status_code == 400

    # 3.4.1 - Accept request
    acc = service.accept_request(user_b.id, user_a.id)
    assert acc.estado == FriendshipStatus.ACCEPTED

    # 3.2.4 - Send request when already friends
    with pytest.raises(HTTPException) as exc:
        service.send_request(user_a.id, user_b.id)
    assert exc.value.status_code == 400

    # 3.6.1 - List friends
    friends = service.list_friends(user_a.id)
    # Could be more than 1 if other tests added friends, but user_a only has user_b
    assert any(f.amigo_id == user_b.id for f in friends)

    # 3.7.1 - Remove friend
    service.remove_friend(user_a.id, user_b.id)
    friends = service.list_friends(user_a.id)
    assert all(f.amigo_id != user_b.id for f in friends)

def test_friendship_reject(db: Session, make_user):
    user_a = make_user(db, username="user_c")
    user_b = make_user(db, username="user_d")
    service = FriendshipService(db)

    # Send and reject
    service.send_request(user_a.id, user_b.id)
    service.reject_request(user_b.id, user_a.id)
    
    # List should not include rejected
    friends = service.list_friends(user_a.id)
    assert all(f.amigo_id != user_b.id for f in friends)

def test_match_invite_flow(db: Session, make_user):
    user_a = make_user(db, username="inviter")
    user_b = make_user(db, username="invited")
    
    service = MatchService(db)

    # 3.8.1 - Send invite
    req = InviteRequest(friend_id=user_b.id, modo=MatchType.BLITZ, control_tiempo="5+0")
    inv = service.send_invite(user_a.id, req)
    assert inv.status == "pending"

    # 3.8.2 - Duplicate invite
    with pytest.raises(HTTPException) as exc:
        service.send_invite(user_a.id, req)
    assert exc.value.status_code == 409

    # 3.9.1 - View pending invites
    pending = service.get_pending_invites(user_b.id)
    assert any(p["inviter_id"] == user_a.id for p in pending)

    sent = service.get_sent_invites(user_a.id)
    assert any(s["invited_id"] == user_b.id for s in sent)

    # 3.10.1 - Accept invite
    res = service.join_match(inv.id, user_b.id)
    assert res["response"].status == "accepted"

    # 3.10.3 - Invite removed from pending (it is now IN_PROGRESS)
    pending = service.get_pending_invites(user_b.id)
    assert all(p["id"] != inv.id for p in pending)

def test_match_invite_decline(db: Session, make_user):
    user_a = make_user(db, username="inviter2")
    user_b = make_user(db, username="invited2")
    service = MatchService(db)

    req = InviteRequest(friend_id=user_b.id, modo=MatchType.BLITZ, control_tiempo="5+0")
    inv = service.send_invite(user_a.id, req)
    
    # 3.11.1 - Decline invite
    res = service.decline_invite(inv.id, user_b.id)
    assert res["response"].status == "cancelled"
    assert res["response"].message == "Invitation declined"

    # 3.11.3 - Removed from pending
    pending = service.get_pending_invites(user_b.id)
    assert all(p["id"] != inv.id for p in pending)
