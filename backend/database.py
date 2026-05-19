from sqlmodel import create_engine, SQLModel, Session
from .config import settings

engine = create_engine(settings.DATABASE_URL, echo=True)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    # Check and add missing columns to 'partidas' table
    from sqlalchemy import text
    with Session(engine) as session:
        try:
            if engine.dialect.name == "sqlite":
                res = session.execute(text("PRAGMA table_info(partidas)")).all()
                columns = [r[1] for r in res]
            else:
                # PostgreSQL
                res = session.execute(text(
                    "SELECT column_name FROM information_schema.columns WHERE table_name='partidas'"
                )).all()
                columns = [r[0] for r in res]
                
            if "tiempo_restante_blancas" not in columns:
                session.execute(text("ALTER TABLE partidas ADD COLUMN tiempo_restante_blancas FLOAT"))
            if "tiempo_restante_negras" not in columns:
                session.execute(text("ALTER TABLE partidas ADD COLUMN tiempo_restante_negras FLOAT"))
            if "ultima_jugada_en" not in columns:
                col_type = "TIMESTAMP" if engine.dialect.name != "sqlite" else "DATETIME"
                session.execute(text(f"ALTER TABLE partidas ADD COLUMN ultima_jugada_en {col_type}"))
            session.commit()
        except Exception as e:
            print(f"[Migration Warning] Could not apply automatic columns migration: {e}")

def get_session():
    with Session(engine) as session:
        yield session
