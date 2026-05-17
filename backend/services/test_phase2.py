from sqlmodel import SQLModel, create_engine, Session, text
from fastapi.testclient import TestClient
from fastapi import HTTPException

from backend.main import app
from backend.database import get_session
from backend.models.usuario import Usuario
from backend.models.match import Match
from backend.models.friendship import Friendship
from backend.models.rating import Rating
from backend.models.statistics import Statistics
from backend.models.enums import MatchStatus, MatchType
from backend.core.security import create_access_token

def run_tests():
    print("==================================================")
    print("   RUNNING INTEGRATION TESTS FOR PHASE 2 WS/RT    ")
    print("==================================================")

    # 1. Create clean in-memory engine and session
    engine = create_engine("sqlite:///file:testdb?mode=memory&cache=shared", connect_args={"check_same_thread": False, "uri": True})
    SQLModel.metadata.create_all(engine)
    
    session = Session(engine)
    print("Tables in memory DB:", session.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).all())
    
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
    
    # 4. Create active match
    match = Match(
        jugador_blancas_id=user1.id,
        jugador_negras_id=user2.id,
        modo=MatchType.RAPID,
        control_tiempo="10+5",
        estado=MatchStatus.IN_PROGRESS
    )
    session.add(match)
    session.commit()
    session.refresh(match)
    
    print(f"[+] Setup DB: Magnus (ID: {user1.id}), Hikaru (ID: {user2.id}), Match (ID: {match.id})")
    
    # 5. Generate Auth Tokens
    token1 = create_access_token(data={"sub": "Magnus"})
    token2 = create_access_token(data={"sub": "Hikaru"})
    
    # 6. Test WebSocket real-time chat and move synchronization
    client = TestClient(app)
    
    print("\n--- Test Case 1: Connect players via WebSockets & Test Chat ---")
    try:
        # Connect Magnus (White) and Hikaru (Black)
        with client.websocket_connect(f"/api/match/{match.id}/ws?token={token1}") as ws1:
            with client.websocket_connect(f"/api/match/{match.id}/ws?token={token2}") as ws2:
                print("[+] Both players successfully connected to the match room WebSocket!")
                
                # Magnus sends chat
                ws1.send_json({"type": "chat", "message": "Good luck, have fun!"})
                
                # Check that Hikaru receives the message
                msg = ws2.receive_json()
                print(f"Hikaru received: {msg}")
                assert msg["type"] == "chat"
                assert msg["username"] == "Magnus"
                assert msg["message"] == "Good luck, have fun!"
                
                print("[\033[92mPASS\033[0m]")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[\033[91mFAIL\033[0m] {e}")
        
    print("\n--- Test Case 2: Move propagation to WS clients ---")
    try:
        # Re-connect to listen for moves
        with client.websocket_connect(f"/api/match/{match.id}/ws?token={token1}") as ws1:
            with client.websocket_connect(f"/api/match/{match.id}/ws?token={token2}") as ws2:
                
                # Magnus (White) makes a move e4 via HTTP POST
                headers = {"Authorization": f"Bearer {token1}"}
                response = client.post(
                    f"/api/match/{match.id}/move", 
                    json={"move": "e4"},
                    headers=headers
                )
                print(f"HTTP Move Response Status: {response.status_code}")
                assert response.status_code == 200
                res_data = response.json()
                assert res_data["success"] == True
                assert res_data["move"] == "e4"
                
                # Check that Hikaru receives the live update over WebSocket
                ws_msg = ws2.receive_json()
                print(f"Hikaru received live WS move: {ws_msg}")
                assert ws_msg["type"] == "move_made"
                assert ws_msg["move"] == "e4"
                assert ws_msg["turn"] == "black"
                assert ws_msg["match_status"] == "in_progress"
                
                # Check that Magnus also receives the live update over WebSocket
                ws_msg_1 = ws1.receive_json()
                print(f"Magnus received live WS move: {ws_msg_1}")
                assert ws_msg_1["type"] == "move_made"
                assert ws_msg_1["move"] == "e4"
                assert ws_msg_1["turn"] == "black"
                
                print("[\033[92mPASS\033[0m]")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[\033[91mFAIL\033[0m] {e}")

    # Reset overrides
    app.dependency_overrides.clear()

if __name__ == "__main__":
    run_tests()
