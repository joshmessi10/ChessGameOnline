from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import create_db_and_tables
from .routers import auth, profile, match, matchmaking, users, friends, settings

app = FastAPI(title="Proyecto Ajedrez API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# Include Routers
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(match.router)
app.include_router(matchmaking.router)
app.include_router(users.router)
app.include_router(friends.router)
app.include_router(settings.router)

@app.get("/")
async def root():
    return {"message": "Welcome to Chess API", "docs": "/docs"}
