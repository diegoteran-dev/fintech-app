from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.database import Base, engine
import app.models  # noqa: F401 — registers all models with SQLAlchemy metadata
from app.api.routes import health, transactions, financial_health, auth, budgets, net_worth, accounts

load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Vault API", version="0.1.0")

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
