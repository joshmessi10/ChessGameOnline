from sqlmodel import SQLModel, create_engine, Session
from backend.models.usuario import Usuario
from backend.models.match import Match
from backend.models.friendship import Friendship
from backend.models.rating import Rating
from backend.models.statistics import Statistics
from backend.models.enums import MatchStatus, MatchType
from backend.schemas.match import MoveRequest
from backend.services.match_service import MatchService
from fastapi import HTTPException

def run_tests():
    print("==================================================")
    print("   RUNNING INTEGRATION TESTS FOR PHASE 1 ENGINE   ")
    print("==================================================")
    
    # Use clean in-memory database
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        # 1. Create two test players
        user1 = Usuario(nombre_usuario="Magnus", correo="magnus@chess.com", hash_contrasena="pwd")
        user2 = Usuario(nombre_usuario="Hikaru", correo="hikaru@chess.com", hash_contrasena="pwd")
        
        session.add(user1)
        session.add(user2)
        session.commit()
        session.refresh(user1)
        session.refresh(user2)
        
        print(f"[+] Created test users: {user1.nombre_usuario} (ID: {user1.id}) and {user2.nombre_usuario} (ID: {user2.id})")
        
        # 2. Create an in-progress match
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
        
        print(f"[+] Created active match (ID: {match.id})")
        
        service = MatchService(session)
        
        # Test Case 1: White makes a valid move (e4)
        print("\n--- Test Case 1: White plays e4 (Valid) ---")
        try:
            res = service.make_move(match.id, user1.id, MoveRequest(move="e4"))
            print(f"Success: {res.success}")
            print(f"Move: {res.move}")
            print(f"New FEN: {res.board_state}")
            print(f"Is Checkmate: {res.is_checkmate}, Is Draw: {res.is_draw}")
            assert res.success == True
            assert res.move == "e4"
            print("[\033[92mPASS\033[0m]")
        except Exception as e:
            print(f"[\033[91mFAIL\033[0m] {e}")
            
        # Test Case 2: Black tries to play out of turn (tries to play e7e5 while it's White's turn)
        # Wait, after White played e4, it IS Black's turn! So let's test Black playing (e5)
        print("\n--- Test Case 2: Black plays e5 (Valid) ---")
        try:
            res = service.make_move(match.id, user2.id, MoveRequest(move="e5"))
            print(f"Success: {res.success}")
            print(f"Move: {res.move}")
            print(f"New FEN: {res.board_state}")
            assert res.success == True
            assert res.move == "e5"
            print("[\033[92mPASS\033[0m]")
        except Exception as e:
            print(f"[\033[91mFAIL\033[0m] {e}")
            
        # Test Case 3: Black tries to play again (out of turn)
        print("\n--- Test Case 3: Black plays d5 out of turn (Should fail) ---")
        try:
            service.make_move(match.id, user2.id, MoveRequest(move="d5"))
            print("[\033[91mFAIL\033[0m] Allowed moving out of turn")
        except HTTPException as e:
            print(f"Expected failure caught: {e.detail}")
            assert e.status_code == 400
            print("[\033[92mPASS\033[0m]")
            
        # Test Case 4: White tries an illegal chess move (e.g. Knight to e5 when blocked or impossible)
        print("\n--- Test Case 4: White plays illegal move Nd3 (Should fail) ---")
        try:
            service.make_move(match.id, user1.id, MoveRequest(move="Nd3"))
            print("[\033[91mFAIL\033[0m] Allowed illegal chess move")
        except HTTPException as e:
            print(f"Expected failure caught: {e.detail}")
            assert e.status_code == 400
            print("[\033[92mPASS\033[0m]")
            
        # Test Case 5: Scholar's Mate (Checkmate detection)
        # State: 1. e4 e5
        # Now White plays Qh5, Black plays Nc6, White plays Bc4, Black plays Nf6, White plays Qxf7#
        print("\n--- Test Case 5: Executing Scholar's Mate ---")
        try:
            # 2. Qh5
            service.make_move(match.id, user1.id, MoveRequest(move="Qh5"))
            # 2... Nc6
            service.make_move(match.id, user2.id, MoveRequest(move="Nc6"))
            # 3. Bc4
            service.make_move(match.id, user1.id, MoveRequest(move="Bc4"))
            # 3... Nf6
            service.make_move(match.id, user2.id, MoveRequest(move="Nf6"))
            # 4. Qxf7# (Checkmate!)
            res = service.make_move(match.id, user1.id, MoveRequest(move="Qxf7"))
            
            print(f"Success: {res.success}")
            print(f"Move: {res.move}")
            print(f"New FEN: {res.board_state}")
            print(f"Is Checkmate: {res.is_checkmate}, Is Draw: {res.is_draw}")
            
            # Fetch match from DB to check ended state
            db_match = session.get(Match, match.id)
            print(f"Match status in database: {db_match.estado}")
            print(f"Match winner ID in database: {db_match.ganador_id}")
            print(f"Match result in database: {db_match.resultado}")
            
            assert res.is_checkmate == True
            assert db_match.estado == MatchStatus.FINISHED
            assert db_match.ganador_id == user1.id
            print("[\033[92mPASS\033[0m]")
        except Exception as e:
            print(f"[\033[91mFAIL\033[0m] {e}")

if __name__ == "__main__":
    run_tests()
