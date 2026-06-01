import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

def test_api_search_users(client: TestClient, db: Session, make_user, bearer):
    searcher = make_user(db, username="api_searcher")
    make_user(db, username="api_leo_1")
    make_user(db, username="api_leo_2")

    headers = bearer(searcher)
    res = client.get("/api/users/search?q=api_leo", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data["results"]) == 2

def test_api_friendship_flow(client: TestClient, db: Session, make_user, bearer):
    user_a = make_user(db, username="api_friend_a")
    user_b = make_user(db, username="api_friend_b")
    
    headers_a = bearer(user_a)
    headers_b = bearer(user_b)

    # Send request A -> B
    res = client.post(f"/api/friends/request?targetID={user_b.id}", headers=headers_a)
    assert res.status_code == 200

    # Accept request B -> A
    res = client.put(f"/api/friends/{user_a.id}/accept", headers=headers_b)
    assert res.status_code == 200

    # List friends A
    res = client.get("/api/friends", headers=headers_a)
    assert res.status_code == 200
    assert len(res.json()) == 1

    # Remove friend A -> B
    res = client.delete(f"/api/friends/{user_b.id}", headers=headers_a)
    assert res.status_code == 200

def test_api_match_invite_flow(client: TestClient, db: Session, make_user, bearer):
    user_a = make_user(db, username="api_match_a")
    user_b = make_user(db, username="api_match_b")

    headers_a = bearer(user_a)
    headers_b = bearer(user_b)

    # Send invite A -> B
    payload = {"friend_id": user_b.id, "modo": "blitz", "control_tiempo": "5+0"}
    res = client.post("/api/match/invite", json=payload, headers=headers_a)
    assert res.status_code == 200
    invite_id = res.json()["id"]

    # Pending invites B
    res = client.get("/api/match/invite/pending", headers=headers_b)
    assert res.status_code == 200
    assert len(res.json()) == 1

    # Accept invite B
    res = client.put(f"/api/match/invite/{invite_id}/accept", headers=headers_b)
    assert res.status_code == 200
