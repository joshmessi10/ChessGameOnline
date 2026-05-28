import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import create_db_and_tables
from .routers import auth, profile, match, matchmaking, users, friends, settings
import asyncio
from sqlmodel import Session
from .database import engine
from .services.matchmaking_service import MatchmakingService
from .models.enums import MatchType
from .core.websocket_manager import websocket_manager

app = FastAPI(title="Proyecto Ajedrez API")

# Build allowed origins — always include localhost for local dev,
# plus the deployed frontend URL set via FRONTEND_URL env variable.
_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]
if os.getenv("FRONTEND_URL"):
    _origins.append(os.getenv("FRONTEND_URL"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def matchmaking_worker():
    while True:
        try:
            await asyncio.sleep(3)
            with Session(engine) as session:
                service = MatchmakingService(session)
                for mode in MatchType:
                    matched = service.try_match_players(mode)
                    if matched:
                        print(f"[Matchmaker] Matched game {matched['match_id']} for mode {mode.value}")
        except Exception as e:
            print(f"[Matchmaker Error] {e}")

# Initialize database and background workers
@app.on_event("startup")
async def on_startup():
    create_db_and_tables()
    asyncio.create_task(matchmaking_worker())
    websocket_manager.start_heartbeat_monitor()

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
