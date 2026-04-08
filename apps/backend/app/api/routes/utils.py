import re
import time
import httpx
import logging
from fastapi import APIRouter

router = APIRouter()
logger = logging.getLogger(__name__)

_FALLBACK_RATE = 6.97
_CACHE_TTL = 3600  # 60 minutes
_cache: dict = {"rate": _FALLBACK_RATE, "source": "fallback", "timestamp": 0.0}

_API_URL = "https://api.dolarbluebolivia.click/fetch/generate"


def get_cached_rate() -> float:
    """Return the currently cached BOB/USD blue-market rate (or fallback 6.97)."""
    return _cache["rate"]


@router.get("/usd-rate")
async def get_usd_rate():
    """
    Return the live BOB/USD blue-market (parallel) rate from dolarbluebolivia.click.
    Fetches server-side to avoid CORS. Caches result 60 minutes.
    Falls back to 6.97 if the external request fails.
    """
    now = time.time()
    if now - _cache["timestamp"] < _CACHE_TTL:
        return {"rate": _cache["rate"], "source": _cache["source"], "currency": "BOB"}

    rate, source = _FALLBACK_RATE, "fallback"
    try:
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
            resp = await client.get(_API_URL)
            resp.raise_for_status()
            data = resp.json()
            # Structure: {"data": {"blue": {"buy": ..., "sell": ...}, ...}}
            blue = data.get("data", {}).get("blue", {})
            raw = blue.get("sell") or blue.get("buy")
            if raw is None:
                # Fallback: scan all numeric values in range 6.50–15.00
                text = resp.text
                candidates = re.findall(r'\b((?:6\.[5-9]|[7-9]\.\d{2}|1[0-4]\.\d{2}))\b', text)
                if candidates:
                    raw = candidates[0]
            if raw is not None:
                rate = round(float(raw), 4)
                source = "live"
            logger.info("USD rate fetched: %.4f (source=%s)", rate, source)
    except Exception as exc:
        logger.warning("USD rate fetch failed: %s — using fallback %.2f", exc, _FALLBACK_RATE)

    _cache["rate"] = rate
    _cache["source"] = source
    _cache["timestamp"] = now
    return {"rate": rate, "source": source, "currency": "BOB"}
