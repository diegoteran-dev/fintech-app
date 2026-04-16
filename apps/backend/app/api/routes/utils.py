import logging
from fastapi import APIRouter
from app.services.exchange_rate import get_rates

router = APIRouter()
logger = logging.getLogger(__name__)


def get_cached_rate() -> float:
    """Return the real BOB/USD blue-market rate from the exchange rate service cache."""
    return get_rates()["BOB"]


@router.get("/usd-rate")
async def get_usd_rate():
    """
    Return the live BOB/USD blue-market (parallel) rate.
    Served from the exchange rate service cache (1-hour TTL).
    """
    rate = get_rates()["BOB"]
    return {"rate": rate, "source": "live", "currency": "BOB"}
