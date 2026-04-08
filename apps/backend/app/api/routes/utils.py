import time
import httpx
from fastapi import APIRouter

router = APIRouter()

_FALLBACK_RATE = 6.97
_CACHE_TTL = 3600  # 60 minutes
_cache: dict = {"rate": _FALLBACK_RATE, "timestamp": 0.0}


@router.get("/usd-rate")
async def get_usd_rate():
    """
    Fetch the live BOB/USD blue-market rate from dolarbluebolivia.click (server-side,
    avoiding browser CORS restrictions). Caches the result for 60 minutes.
    Falls back to 6.97 BOB/USD if the external request fails.
    """
    now = time.time()
    if now - _cache["timestamp"] < _CACHE_TTL:
        return {"rate": _cache["rate"], "source": "cache", "currency": "BOB"}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("https://dolarbluebolivia.click/api/blue")
            resp.raise_for_status()
            data = resp.json()
            # Try common field names the API may use
            raw = (
                data.get("sell")
                or data.get("venta")
                or data.get("precio_venta")
                or data.get("rate")
                or _FALLBACK_RATE
            )
            rate = round(float(raw), 4)
    except Exception:
        rate = _FALLBACK_RATE
        _cache["rate"] = rate
        _cache["timestamp"] = now
        return {"rate": rate, "source": "fallback", "currency": "BOB"}

    _cache["rate"] = rate
    _cache["timestamp"] = now
    return {"rate": rate, "source": "live", "currency": "BOB"}
