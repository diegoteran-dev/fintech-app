from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.holding import Holding
from app.models.user import User
from app.api.deps import get_current_user
from app.services.price_fetcher import get_price, search_ticker

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class HoldingCreate(BaseModel):
    asset_type: str   # stock | etf | metal | crypto
    ticker: str
    name: str | None = None
    quantity: float


class HoldingUpdate(BaseModel):
    quantity: float


class HoldingOut(BaseModel):
    id: int
    asset_type: str
    ticker: str
    name: str | None
    quantity: float
    # Enriched at query time
    price: float | None = None
    value: float | None = None

    model_config = {"from_attributes": True}


class TickerResult(BaseModel):
    ticker: str
    name: str | None
    price: float | None


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("", response_model=list[HoldingOut])
async def list_holdings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(Holding).filter(Holding.user_id == current_user.id).all()
    out = []
    for h in rows:
        price_data = await get_price(h.ticker, h.asset_type)
        price = price_data["price"] if price_data else None
        out.append(HoldingOut(
            id=h.id,
            asset_type=h.asset_type,
            ticker=h.ticker,
            name=h.name or (price_data["name"] if price_data else h.ticker),
            quantity=h.quantity,
            price=price,
            value=round(price * h.quantity, 2) if price else None,
        ))
    return out


@router.post("", response_model=HoldingOut, status_code=201)
async def create_holding(
    data: HoldingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticker = data.ticker.strip().upper()
    # Validate ticker and fetch name/price
    price_data = await get_price(ticker, data.asset_type)
    if not price_data:
        raise HTTPException(status_code=422, detail=f"Ticker '{ticker}' not found or price unavailable")

    holding = Holding(
        user_id=current_user.id,
        asset_type=data.asset_type,
        ticker=ticker,
        name=data.name or price_data.get("name") or ticker,
        quantity=data.quantity,
    )
    db.add(holding)
    db.commit()
    db.refresh(holding)
    return HoldingOut(
        id=holding.id,
        asset_type=holding.asset_type,
        ticker=holding.ticker,
        name=holding.name,
        quantity=holding.quantity,
        price=price_data["price"],
        value=round(price_data["price"] * holding.quantity, 2),
    )


@router.patch("/{holding_id}", response_model=HoldingOut)
async def update_holding(
    holding_id: int,
    data: HoldingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    holding = db.query(Holding).filter(
        Holding.id == holding_id, Holding.user_id == current_user.id
    ).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    holding.quantity = data.quantity  # type: ignore[assignment]
    db.commit()
    db.refresh(holding)
    price_data = await get_price(holding.ticker, holding.asset_type)
    price = price_data["price"] if price_data else None
    return HoldingOut(
        id=holding.id, asset_type=holding.asset_type, ticker=holding.ticker,
        name=holding.name, quantity=holding.quantity,
        price=price, value=round(price * holding.quantity, 2) if price else None,
    )


@router.delete("/{holding_id}", status_code=204)
def delete_holding(
    holding_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    holding = db.query(Holding).filter(
        Holding.id == holding_id, Holding.user_id == current_user.id
    ).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    db.delete(holding)
    db.commit()


@router.get("/search", response_model=list[TickerResult])
async def search(
    q: str = Query(..., min_length=1),
    type: str = Query(...),
    current_user: User = Depends(get_current_user),
):
    results = await search_ticker(q.strip(), type)
    return [TickerResult(ticker=r["ticker"], name=r.get("name"), price=r.get("price")) for r in results]
