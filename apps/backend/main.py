from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from dotenv import load_dotenv

import os as _os
import logging as _logging

load_dotenv()

from app.database import Base, engine
import app.models  # noqa: F401 — registers all models with SQLAlchemy metadata
from app.api.routes import health, transactions, financial_health, auth, budgets, net_worth, accounts
from app.core.limiter import limiter

# Run pending Alembic migrations on every boot (non-fatal if it fails)
_logger = _logging.getLogger(__name__)
try:
    from alembic.config import Config as _AlembicCfg
    from alembic import command as _alembic_cmd
    _ini = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "alembic.ini")
    _alembic_cmd.upgrade(_AlembicCfg(_ini), "head")
    _logger.info("Alembic migrations applied")
except Exception as _exc:
    _logger.error("Alembic migration error (server will still start): %s", _exc)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Vault API", version="0.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

import os as _os

_origins = ["http://localhost:3000", "http://localhost:3001"]
_frontend_url = _os.getenv("FRONTEND_URL")
if _frontend_url:
    _origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(financial_health.router, prefix="/api/financial-health", tags=["financial-health"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["budgets"])
app.include_router(net_worth.router, prefix="/api/net-worth", tags=["net-worth"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["accounts"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
