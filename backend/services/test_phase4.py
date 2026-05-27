from sqlmodel import SQLModel, create_engine, Session, text
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_session
from backend.models.usuario import Usuario
from backend.models.match import Match
from backend.models.enums import MatchStatus, MatchType, MatchResult
from backend.core.security import create_access_token
from backend.services.match_service import MatchService

from sqlalchemy.pool import StaticPool

def run_tests():
    print("==================================================")
    print("   RUNNING INTEGRATION TESTS FOR PHASE 4 INVITES  ")
    print("==================================================")

    # 1. Create clean in-memory engine and session
    engine = create_engine(
        "sqlite:///file:testdb_p4?mode=memory&cache=shared",
        connect_args={"check_same_thread": False, "uri": True},
        poolclass=StaticPool
    )

    SQLModel.metadata.create_all(engine)
    
    session = Session(engine)
    
    # 2. Inject dependency override
    def override_get_session():
        with Session(engine) as s:
            yield s
            
    app.dependency_overrides[get_session] = override_get_session
    
    # 3. Clean and Create test users
    session.execute(text("DELETE FROM partidas"))
    session.execute(text("DELETE FROM usuarios"))
    session.commit()
    
    user1 = Usuario(nombre_usuario="Magnus", correo="magnus@chess.com", hash_contrasena="pwd")
    user2 = Usuario(nombre_usuario="Hikaru", correo="hikaru@chess.com", hash_contrasena="pwd")
    session.add(user1)
    session.add(user2)
    session.commit()
    session.refresh(user1)
    session.refresh(user2)
    
    print(f"[+] Setup DB: Magnus (ID: {user1.id}), Hikaru (ID: {user2.id})")
    
    # Generate Auth Tokens
    token1 = create_access_token(data={"sub": "Magnus"})
    token2 = create_access_token(data={"sub": "Hikaru"})
    
    client = TestClient(app)
    
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}
    
    print("\n--- Test Case 1: Send game invitation ---")
    resp_invite = client.post(
        "/api/match/invite",
        json={"friend_id": user2.id, "modo": "rapid", "control_tiempo": "10+5"},
        headers=headers1
    )
    assert resp_invite.status_code == 200
    invite_id = resp_invite.json()["id"]
    assert resp_invite.json()["status"] == "pending"
    print(f"[PASS] Challenge invitation sent successfully. Invite ID: {invite_id}")

    print("\n--- Test Case 1.5: Match must remain WAITING until guest accepts ---")
    with Session(engine) as s:
        db_match = s.query(Match).filter(Match.id == invite_id).first()
        assert db_match is not None
        assert db_match.estado == MatchStatus.WAITING
        assert db_match.resultado == MatchResult.ONGOING
    print("[PASS] Invitation only creates WAITING match, not active game.")

    print("\n--- Test Case 1.6: Duplicate invitation between same players must be blocked ---")
    resp_dup = client.post(
        "/api/match/invite",
        json={"friend_id": user2.id, "modo": "bullet", "control_tiempo": "1+0"},
        headers=headers1
    )
    assert resp_dup.status_code == 409
    print("[PASS] Duplicate pending challenge blocked with HTTP 409.")

    print("\n--- Test Case 2: Decline game invitation ---")
    resp_decline = client.delete(
        f"/api/match/invite/{invite_id}/decline",
        headers=headers2
    )
    assert resp_decline.status_code == 200
    assert resp_decline.json()["status"] == "cancelled"
    print("[PASS] Challenge invitation successfully declined.")

    print("\n--- Test Case 3: Send another invitation ---")
    resp_invite2 = client.post(
        "/api/match/invite",
        json={"friend_id": user2.id, "modo": "rapid", "control_tiempo": "10+5"},
        headers=headers1
    )
    assert resp_invite2.status_code == 200
    invite_id2 = resp_invite2.json()["id"]
    print(f"[PASS] Second challenge invitation sent. Invite ID: {invite_id2}")

    print("\n--- Test Case 3.5: Fetch pending game invitations ---")
    resp_pending = client.get(
        "/api/match/invite/pending",
        headers=headers2
    )
    assert resp_pending.status_code == 200
    pending_list = resp_pending.json()
    assert len(pending_list) == 1
    assert pending_list[0]["id"] == invite_id2
    assert pending_list[0]["inviter_username"] == "Magnus"
    assert pending_list[0]["modo"] == "rapid"
    assert pending_list[0]["control_tiempo"] == "10+5"
    print("[PASS] Pending challenge invitations retrieved and validated successfully.")

    print("\n--- Test Case 4: Accept game invitation ---")

    resp_accept = client.put(
        f"/api/match/invite/{invite_id2}/accept",
        headers=headers2
    )
    assert resp_accept.status_code == 200
    assert resp_accept.json()["status"] == "accepted"
    print("[PASS] Challenge invitation successfully accepted.")

    print("\n--- Test Case 5: Verify Match is in_progress in DB ---")
    with Session(engine) as s:
        db_match = s.query(Match).filter(Match.id == invite_id2).first()
        assert db_match is not None
        assert db_match.estado == MatchStatus.IN_PROGRESS
        assert db_match.resultado == MatchResult.ONGOING
    print("[PASS] Match state successfully verified as IN_PROGRESS.")

    print("\n==================================================")
    print("     ALL INTEGRATION TESTS PASSED FOR PHASE 4     ")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
