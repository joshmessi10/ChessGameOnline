import pytest
from sqlmodel import Session
from backend.services.matchmaking_service import MatchmakingService
from backend.models.enums import MatchType
from backend.schemas.matchmaking import QueueRequest

@pytest.fixture(autouse=True)
def reset_matchmaking_state():
    MatchmakingService._queues = {
        MatchType.BULLET: [],
        MatchType.BLITZ: [],
        MatchType.RAPID: [],
        MatchType.CLASSICAL: []
    }
    MatchmakingService._matches = {}
    yield
    MatchmakingService._queues = {
        MatchType.BULLET: [],
        MatchType.BLITZ: [],
        MatchType.RAPID: [],
        MatchType.CLASSICAL: []
    }
    MatchmakingService._matches = {}

def test_join_queue(db: Session, make_user):
    user_a = make_user(db, username="mm_user_a")
    service = MatchmakingService(db)

    # 4.2.1 - Join queue
    req = QueueRequest(modo=MatchType.BLITZ)
    res = service.join_queue(user_a.id, req)
    assert res.status == "queued"

    # 4.2.2 - Already in queue
    res2 = service.join_queue(user_a.id, req)
    assert res2.status == "already_queued"

def test_queue_status_and_leave(db: Session, make_user):
    user_a = make_user(db, username="mm_user_b")
    service = MatchmakingService(db)

    req = QueueRequest(modo=MatchType.RAPID)
    service.join_queue(user_a.id, req)

    # 4.3.1, 4.3.2, 4.3.3 - View active search status
    status = service.get_status(user_a.id)
    assert status["status"] == "searching"

    # 4.5.1, 4.5.2 - Cancel search
    res = service.leave_queue(user_a.id)
    assert res.status == "removed"
    
    status_after = service.get_status(user_a.id)
    assert status_after["status"] == "idle"

def test_match_players(db: Session, make_user):
    user_a = make_user(db, username="mm_user_c")
    user_b = make_user(db, username="mm_user_d")
    service = MatchmakingService(db)

    # 4.4.1, 4.4.3 - Match two compatible players
    req = QueueRequest(modo=MatchType.BLITZ)
    service.join_queue(user_a.id, req)
    service.join_queue(user_b.id, req)

    match_result = service.try_match_players(MatchType.BLITZ)
    assert match_result is not None
    assert match_result["white_id"] in (user_a.id, user_b.id)
    assert match_result["black_id"] in (user_a.id, user_b.id)
    assert match_result["white_id"] != match_result["black_id"]

    # 4.4.4 - Access match created
    status_a = service.get_status(user_a.id)
    status_b = service.get_status(user_b.id)
    assert status_a["status"] == "matched"
    assert status_b["status"] == "matched"
    assert status_a["matchID"] == status_b["matchID"]
    assert status_a["matchID"] == match_result["match_id"]

def test_match_players_different_modes(db: Session, make_user):
    user_a = make_user(db, username="mm_user_e")
    user_b = make_user(db, username="mm_user_f")
    service = MatchmakingService(db)

    # 4.4.2 - Respect selected mode
    service.join_queue(user_a.id, QueueRequest(modo=MatchType.BLITZ))
    service.join_queue(user_b.id, QueueRequest(modo=MatchType.RAPID))

    match_blitz = service.try_match_players(MatchType.BLITZ)
    assert match_blitz is None

    match_rapid = service.try_match_players(MatchType.RAPID)
    assert match_rapid is None
