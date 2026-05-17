from sqlmodel import SQLModel, create_engine, Session, text
from fastapi.testclient import TestClient
from datetime import datetime, timedelta, timezone

from backend.main import app
from backend.database import get_session
from backend.models.usuario import Usuario
from backend.models.rating import Rating
from backend.models.enums import MatchType
from backend.core.security import create_access_token
from backend.services.matchmaking_service import MatchmakingService

def run_tests():
    print("==================================================")
    print("  RUNNING INTEGRATION TESTS FOR PHASE 3 MATCHMAKING ")
    print("==================================================")

    # 1. Create clean in-memory engine and session
    engine = create_engine("sqlite:///file:testdb_p3?mode=memory&cache=shared", connect_args={"check_same_thread": False, "uri": True})
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
    session.execute(text("DELETE FROM ratings"))
    session.commit()
    
    user1 = Usuario(nombre_usuario="Magnus", correo="magnus@chess.com", hash_contrasena="pwd")
    user2 = Usuario(nombre_usuario="Hikaru", correo="hikaru@chess.com", hash_contrasena="pwd")
    session.add(user1)
    session.add(user2)
    session.commit()
    session.refresh(user1)
    session.refresh(user2)

    # Set ELO for Blitz mode: Magnus (2800) and Hikaru (2780)
    rating1 = Rating(usuario_id=user1.id, modo=MatchType.BLITZ, rating=2800)
    rating2 = Rating(usuario_id=user2.id, modo=MatchType.BLITZ, rating=2780)
    session.add(rating1)
    session.add(rating2)
    session.commit()
    
    print(f"[+] Setup DB: Magnus (ID: {user1.id}, Blitz ELO: 2800), Hikaru (ID: {user2.id}, Blitz ELO: 2780)")
    
    # Generate Auth Tokens
    token1 = create_access_token(data={"sub": "Magnus"})
    token2 = create_access_token(data={"sub": "Hikaru"})
    
    client = TestClient(app)
    
    print("\n--- Test Case 1: Join queue for both players ---")
    
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}
    
    # Magnus joins
    resp1 = client.post("/api/matchmaking/join", json={"modo": "blitz"}, headers=headers1)
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "queued"
    print("[PASS] Magnus successfully joined queue.")

    # Hikaru joins
    resp2 = client.post("/api/matchmaking/join", json={"modo": "blitz"}, headers=headers2)
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "queued"
    print("[PASS] Hikaru successfully joined queue.")

    # Double join check
    resp_double = client.post("/api/matchmaking/join", json={"modo": "blitz"}, headers=headers1)
    assert resp_double.status_code == 200
    assert resp_double.json()["status"] == "already_queued"
    print("[PASS] Prevented duplicate queue joining successfully.")

    print("\n--- Test Case 2: Query searching status ---")
    status1 = client.get("/api/matchmaking/status", headers=headers1)
    assert status1.status_code == 200
    assert status1.json()["status"] == "searching"
    print("[PASS] Status correctly returned 'searching'.")

    print("\n--- Test Case 3: Try Matchmaking with dynamic ELO Tolerance ---")
    
    # Let's verify our in-memory queue inside MatchmakingService
    # Currently, they have waitTime = 0, meaning tolerance = 100.
    # ELO difference is 2800 - 2780 = 20.
    # 20 <= 100, so they should match immediately!
    
    service = MatchmakingService(session)
    matched = service.try_match_players(MatchType.BLITZ)
    
    assert matched is not None
    assert matched["white_id"] in [user1.id, user2.id]
    assert matched["black_id"] in [user1.id, user2.id]
    print(f"[PASS] Successfully matched players! Match ID: {matched['match_id']}")

    print("\n--- Test Case 4: Query matched status to redirect ---")
    status_matched1 = client.get("/api/matchmaking/status", headers=headers1)
    assert status_matched1.status_code == 200
    assert status_matched1.json()["status"] == "matched"
    match_id = status_matched1.json()["matchID"]
    assert match_id == matched["match_id"]
    print(f"[PASS] Magnus resolved status as 'matched' with MatchID: {match_id}")

    status_matched2 = client.get("/api/matchmaking/status", headers=headers2)
    assert status_matched2.status_code == 200
    assert status_matched2.json()["status"] == "matched"
    assert status_matched2.json()["matchID"] == matched["match_id"]
    print(f"[PASS] Hikaru resolved status as 'matched' with MatchID: {match_id}")

    print("\n--- Test Case 5: Verify queue is empty after matching ---")
    status_idle = client.get("/api/matchmaking/status", headers=headers1)
    assert status_idle.json()["status"] == "idle"
    print("[PASS] Magnus queue status correctly reset to idle.")

    print("\n==================================================")
    print("     ALL INTEGRATION TESTS PASSED FOR PHASE 3     ")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
