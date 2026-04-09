#!/bin/bash
# ==========================================
# ChessCamp — Backend Startup Script
# Creates venv, installs deps, starts server
# ==========================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$PROJECT_DIR/.venv"
REQUIREMENTS="$PROJECT_DIR/backend/requirements.txt"

echo ""
echo "  ♟  ChessCamp Backend Setup"
echo "  =============================="

# 1. Create virtual environment if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
  echo "  → Creating virtual environment..."
  python3 -m venv "$VENV_DIR"
  echo "  ✓ Virtual environment created at .venv/"
else
  echo "  ✓ Virtual environment already exists"
fi

# 2. Activate the venv
source "$VENV_DIR/bin/activate"

# 3. Install/update dependencies
echo "  → Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r "$REQUIREMENTS"
pip install -q "pydantic[email]"
echo "  ✓ Dependencies installed"

# 4. Ensure .env uses SQLite
if ! grep -q "sqlite" "$PROJECT_DIR/.env" 2>/dev/null; then
  echo "  → Setting up SQLite database..."
  sed -i.bak 's|DATABASE_URL=.*|DATABASE_URL=sqlite:///./chess.db|g' "$PROJECT_DIR/.env" 2>/dev/null || true
fi

# 5. Start the server
echo "  → Starting FastAPI server on http://localhost:8000"
echo "  → API docs available at http://localhost:8000/docs"
echo ""

cd "$PROJECT_DIR"
.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
