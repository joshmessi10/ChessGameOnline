from sqlmodel import SQLModel, create_engine, Session, text
from fastapi.testclient import TestClient
from datetime import datetime, timezone

from backend.main import app
from backend.database import get_session
from backend.models.usuario import Usuario
from backend.models.match import Match
from backend.models.statistics import Statistics
from backend.models.enums import MatchStatus, MatchType, MatchResult
from backend.core.security import create_access_token
from backend.services.match_service import MatchService

def run_tests():
    print("==================================================")
    print("  RUNNING INTEGRATION TESTS FOR PHASE 5 END/STATS ")
    print("==================================================")

    # 1. Create clean in-memory engine and session
    engine = create_engine("sqlite:///file:testdb_p5?mode=memory&cache=shared", connect_args={"check_same_thread": False, "uri": True})
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
    session.execute(text("DELETE FROM estadisticas"))
    session.execute(text("DELETE FROM ratings"))
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

    # 4. Create active match #1
    match1 = Match(
        jugador_blancas_id=user1.id,
        jugador_negras_id=user2.id,
        modo=MatchType.BLITZ,
        control_tiempo="3+2",
        estado=MatchStatus.IN_PROGRESS
    )
    session.add(match1)
    session.commit()
    session.refresh(match1)
    
    print("\n--- Test Case 1: End Game via Resignation ---")
    # Magnus resigns -> Hikaru wins
    resp_end = client.put(
        f"/api/match/{match1.id}/end",
        json={"reason": "resignation"},
        headers=headers1
    )
    assert resp_end.status_code == 200
    res_payload = resp_end.json()
    assert res_payload["result"] == MatchResult.BLACK_WIN
    print("[PASS] Resignation resolved result as BLACK_WIN successfully.")
    print(f"       New ELO White: {res_payload['newELOPlayerWhite']}, New ELO Black: {res_payload['newELOPlayerBlack']}")

    print("\n--- Test Case 2: Verify database Statistics for resignation ---")
    with Session(engine) as s:
        # Check White (Magnus) career stats
        stats_w = s.query(Statistics).filter(Statistics.usuario_id == user1.id).first()
        assert stats_w is not None
        assert stats_w.partidas_jugadas == 1
        assert stats_w.victorias == 0
        assert stats_w.derrotas == 1
        assert stats_w.empates == 0
        
        # Check Black (Hikaru) career stats
        stats_b = s.query(Statistics).filter(Statistics.usuario_id == user2.id).first()
        assert stats_b is not None
        assert stats_b.partidas_jugadas == 1
        assert stats_b.victorias == 1
        assert stats_b.derrotas == 0
        assert stats_b.empates == 0
        
    print("[PASS] Career statistics updated correctly on resignation.")

    print("\n--- Test Case 3: Match resolution via checkmate in make_move ---")
    # Setup active match #2
    match2 = Match(
        jugador_blancas_id=user1.id,
        jugador_negras_id=user2.id,
        modo=MatchType.BLITZ,
        control_tiempo="3+2",
        estado=MatchStatus.IN_PROGRESS,
        # Setup board one move away from Fool's Mate
        # 1. f3 e5 2. g4 Qh4#
        movimientos_pgn="f3 e5 g4"
    )
    session.add(match2)
    session.commit()
    session.refresh(match2)

    # Hikaru plays Qh4# (Fool's Mate)
    resp_move = client.post(
        f"/api/match/{match2.id}/move",
        json={"move": "Qh4#"},
        headers=headers2
    )
    assert resp_move.status_code == 200
    assert resp_move.json()["is_checkmate"] is True
    print("[PASS] Checkmate move Qh4# registered successfully.")

    # Check updated stats in DB
    with Session(engine) as s:
        # Check White (Magnus) career stats (should be: 2 matches, 0 wins, 2 losses)
        stats_w2 = s.query(Statistics).filter(Statistics.usuario_id == user1.id).first()
        assert stats_w2.partidas_jugadas == 2
        assert stats_w2.victorias == 0
        assert stats_w2.derrotas == 2
        
        # Check Black (Hikaru) career stats (should be: 2 matches, 2 wins, 0 losses)
        stats_b2 = s.query(Statistics).filter(Statistics.usuario_id == user2.id).first()
        assert stats_b2.partidas_jugadas == 2
        assert stats_b2.victorias == 2
        assert stats_b2.derrotas == 0
        
    print("[PASS] Career statistics and ELO updated correctly on checkmate.")

    print("\n==================================================")
    print("     ALL INTEGRATION TESTS PASSED FOR PHASE 5     ")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
