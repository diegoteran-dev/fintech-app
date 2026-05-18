"""
Inflation data via World Bank public API.
Cached 24 h per country — no auth required.
"""
from __future__ import annotations

import time
import httpx
from fastapi import APIRouter, Query

router = APIRouter()

_CACHE: dict[str, dict] = {}
_TTL = 86400  # 24 hours

COUNTRY_NAMES: dict[str, str] = {
    "BO": "Bolivia", "AR": "Argentina", "MX": "Mexico", "US": "United States",
    "BR": "Brazil",  "CO": "Colombia",  "PE": "Peru",   "CL": "Chile",
    "VE": "Venezuela", "EC": "Ecuador", "PY": "Paraguay", "UY": "Uruguay",
    "GT": "Guatemala",  "HN": "Honduras", "SV": "El Salvador", "CR": "Costa Rica",
    "PA": "Panama",    "DO": "Dominican Republic",
}


@router.get("")
async def get_inflation(country: str = Query("BO", min_length=2, max_length=3)):
    country = country.upper()
    now = time.time()
    if country in _CACHE and now - _CACHE[country]["ts"] < _TTL:
        return _CACHE[country]["data"]

    try:
        url = f"https://api.worldbank.org/v2/country/{country}/indicator/FP.CPI.TOTL.ZG"
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(url, params={"format": "json", "mrv": 10, "per_page": 10})
            r.raise_for_status()
            raw = r.json()
            entries = raw[1] if len(raw) > 1 and raw[1] else []
            history = sorted(
                [{"year": e["date"], "rate": round(float(e["value"]), 2)}
                 for e in entries if e.get("value") is not None],
                key=lambda x: x["year"],
            )
            result = {
                "country": country,
                "country_name": COUNTRY_NAMES.get(country, country),
                "latest_rate": history[-1]["rate"] if history else None,
                "latest_year": history[-1]["year"] if history else None,
                "history": history,
            }
    except Exception as exc:
        result = {
            "country": country,
            "country_name": COUNTRY_NAMES.get(country, country),
            "latest_rate": None,
            "latest_year": None,
            "history": [],
            "error": str(exc),
        }

    _CACHE[country] = {"data": result, "ts": now}
    return result
