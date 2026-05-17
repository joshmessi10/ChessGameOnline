from sqlmodel import SQLModel, create_engine, Session
from backend.models.usuario import Usuario
from backend.models.match import Match
from backend.models.friendship import Friendship
from backend.models.rating import Rating
from backend.models.statistics import Statistics
from backend.models.enums import MatchStatus, MatchType, MatchResult
from backend.core.security import get_password_hash
from backend.config import settings

def setup_game():
    print("==================================================")
    print("     SETTING UP PLAYGROUND FOR MANUAL TESTING     ")
    print("==================================================")
    
    # Connect to the real local chess.db
    engine = create_engine(settings.DATABASE_URL)
    
    # Re-create all tables in the real database
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        # Check if users already exist, if so delete them so we start fresh
        existing_magnus = session.query(Usuario).filter(Usuario.nombre_usuario == "Magnus").first()
        if existing_magnus:
            session.delete(existing_magnus)
        existing_hikaru = session.query(Usuario).filter(Usuario.nombre_usuario == "Hikaru").first()
        if existing_hikaru:
            session.delete(existing_hikaru)
            
        # Delete old match if any
        existing_match = session.query(Match).filter(Match.id == 1).first()
        if existing_match:
            session.delete(existing_match)
            
        session.commit()
        
        # 1. Create test users with hashed passwords
        user1 = Usuario(
            nombre_usuario="Magnus", 
            correo="magnus@chess.com", 
            hash_contrasena=get_password_hash("magnus123")
        )
        user2 = Usuario(
            nombre_usuario="Hikaru", 
            correo="hikaru@chess.com", 
            hash_contrasena=get_password_hash("hikaru123")
        )
        
        session.add(user1)
        session.add(user2)
        session.commit()
        session.refresh(user1)
        session.refresh(user2)
        
        # 2. Add ratings
        rating1 = Rating(usuario_id=user1.id, modo=MatchType.RAPID, rating=2800)
        rating2 = Rating(usuario_id=user2.id, modo=MatchType.RAPID, rating=2780)
        
        # 3. Add statistics
        stats1 = Statistics(usuario_id=user1.id, victorias=15, derrotas=2, empates=3, partidas_jugadas=20)
        stats2 = Statistics(usuario_id=user2.id, victorias=12, derrotas=4, empates=4, partidas_jugadas=20)
        
        session.add(rating1)
        session.add(rating2)
        session.add(stats1)
        session.add(stats2)
        
        # 4. Create active match with ID 1
        match = Match(
            id=1,
            jugador_blancas_id=user1.id,
            jugador_negras_id=user2.id,
            modo=MatchType.RAPID,
            control_tiempo="10:00",
            estado=MatchStatus.IN_PROGRESS,
            resultado=MatchResult.ONGOING
        )
        session.add(match)
        session.commit()
        
        print("\n[+] SUCCESS! Test playground environment initialized successfully!")
        print("\nTest User Accounts Created:")
        print("  - Player 1 (White): Magnus  / Password: magnus123")
        print("  - Player 2 (Black): Hikaru  / Password: hikaru123")
        print("Active Match ID created: #1")
        print("==================================================")

if __name__ == "__main__":
    setup_game()
