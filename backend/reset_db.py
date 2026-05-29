from database import engine, create_db_and_tables
from sqlmodel import SQLModel

# Importar los modelos para que SQLModel los registre en la metadata
from models.usuario import Usuario
from models.match import Match
from models.statistics import Statistics
from models.rating import Rating
from models.friendship import Friendship

def reset_database():
    print("Conectando a la base de datos...")
    
    print("Borrando todas las tablas existentes...")
    SQLModel.metadata.drop_all(engine)
    
    print("Recreando las tablas con el nuevo esquema...")
    create_db_and_tables()
    
    print("¡Base de datos limpia y lista para usar!")

if __name__ == "__main__":
    reset_database()
