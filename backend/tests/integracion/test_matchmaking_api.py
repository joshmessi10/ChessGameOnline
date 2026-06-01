import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session
from backend.services.matchmaking_service import MatchmakingService
from backend.models.enums import MatchType

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

def test_api_matchmaking_flow(client: TestClient, db: Session, make_user, bearer):
    user_a = make_user(db, username="api_mm_a")
    user_b = make_user(db, username="api_mm_b")

    headers_a = bearer(user_a)
    headers_b = bearer(user_b)

    # A joins queue
    res = client.post("/api/matchmaking/join", json={"modo": "blitz"}, headers=headers_a)
    assert res.status_code == 200
    assert res.json()["status"] == "queued"

    # A checks status
    res = client.get("/api/matchmaking/status", headers=headers_a)
    assert res.status_code == 200
    assert res.json()["status"] == "searching"

    # A tries to join again
    res = client.post("/api/matchmaking/join", json={"modo": "blitz"}, headers=headers_a)
    assert res.status_code == 200
    assert res.json()["status"] == "already_queued"

    # A leaves queue
    res = client.delete("/api/matchmaking/leave", headers=headers_a)
    assert res.status_code == 200
    assert res.json()["status"] == "removed"

    # A checks status again
    res = client.get("/api/matchmaking/status", headers=headers_a)
    assert res.status_code == 200
    assert res.json()["status"] == "idle"

def test_api_matchmaking_match(client: TestClient, db: Session, make_user, bearer):
    user_a = make_user(db, username="api_mm_c")
    user_b = make_user(db, username="api_mm_d")

    headers_a = bearer(user_a)
    headers_b = bearer(user_b)

    # Both join
    client.post("/api/matchmaking/join", json={"modo": "rapid"}, headers=headers_a)
    client.post("/api/matchmaking/join", json={"modo": "rapid"}, headers=headers_b)

    # Trigger matchmaking algorithm (usually done by a background worker)
    # We call the service method directly here to simulate the worker
    service = MatchmakingService(db)
    service.try_match_players(MatchType.RAPID)

    # Both should be matched
    res_a = client.get("/api/matchmaking/status", headers=headers_a)
    res_b = client.get("/api/matchmaking/status", headers=headers_b)

    assert res_a.status_code == 200
    assert res_a.json()["status"] == "matched"
    assert "matchID" in res_a.json()

    assert res_b.status_code == 200
    assert res_b.json()["status"] == "matched"
    assert res_b.json()["matchID"] == res_a.json()["matchID"]
