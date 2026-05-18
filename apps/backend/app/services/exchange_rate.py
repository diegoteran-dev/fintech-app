"""
Exchange rate service — fetches USD-based rates from open.er-api.com (free, no key required).
Results are cached in memory for 1 hour to avoid rate limits.

BOB (Boliviano) uses the real blue-market (parallel) rate from dolarbluebolivia.click
instead of the official government-fixed rate, which does not reflect real purchasing power.

Supported currencies: USD, BOB (Bolivia), ARS (Argentina), MXN (Mexico).
"""
import re
import time
import logging
import httpx

logger = logging.getLogger(__name__)

# Currencies supported by the app
SUPPORTED_CURRENCIES = ["USD", "BOB", "ARS", "MXN"]

# Fallback rates (1 USD = X local currency) — updated April 2026
# BOB fallback is the blue-market rate, NOT the official 6.91.
_FALLBACK_RATES: dict[str, float] = {
    "USD": 1.0,
    "BOB": 6.97,
    "ARS": 1030.0,
    "MXN": 17.15,
}

_CACHE: dict[str, float] = {}
_CACHE_TS: float = 0.0
_CACHE_TTL: float = 3600.0  # 1 hour

_BOB_BLUE_URL = "https://api.dolarbluebolivia.click/fetch/generate"


def _fetch_bob_blue_rate() -> float:
    """Fetch the real BOB/USD blue-market (parallel) rate from dolarbluebolivia.click."""
    try:
        with httpx.Client(timeout=6.0, follow_redirects=True) as client:
            resp = client.get(_BOB_BLUE_URL)
            resp.raise_for_status()
            data = resp.json()
            blue = data.get("data", {}).get("blue", {})
            raw = blue.get("sell") or blue.get("buy")
            if raw is None:
                candidates = re.findall(r'\b((?:6\.[5-9]|[7-9]\.\d{2}|1[0-4]\.\d{2}))\b', resp.text)
                if candidates:
                    raw = candidates[0]
            if raw is not None:
                rate = round(float(raw), 4)
                logger.info("BOB blue-market rate fetched: %.4f", rate)
                return rate
    except Exception as exc:
        logger.warning("BOB blue-market rate fetch failed (%s) — using fallback %.2f", exc, _FALLBACK_RATES["BOB"])
    return _FALLBACK_RATES["BOB"]


def _fetch_rates() -> dict[str, float]:
    """Fetch latest rates. ARS/MXN from open.er-api.com; BOB from blue-market API."""
    url = "https://open.er-api.com/v6/latest/USD"
    result: dict[str, float] = dict(_FALLBACK_RATES)
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()
            rates = data.get("rates", {})
            for currency in SUPPORTED_CURRENCIES:
                if currency == "BOB":
                    continue  # BOB handled separately below
                if currency in rates:
                    result[currency] = float(rates[currency])
    except Exception as exc:
        logger.warning("open.er-api.com fetch failed (%s) — using fallback rates for ARS/MXN", exc)

    # Always override BOB with the real blue-market rate
    result["BOB"] = _fetch_bob_blue_rate()
    return result


def get_rates() -> dict[str, float]:
    """Return cached rates, refreshing if stale."""
    global _CACHE, _CACHE_TS
    if not _CACHE or (time.monotonic() - _CACHE_TS) > _CACHE_TTL:
        _CACHE = _fetch_rates()
        _CACHE_TS = time.monotonic()
    return _CACHE


def to_usd(amount: float, currency: str) -> float:
    """Convert an amount in the given currency to USD."""
    if currency == "USD":
        return amount
    rates = get_rates()
    rate = rates.get(currency.upper())
    if not rate or rate == 0:
        logger.warning("Unknown currency %s — treating as USD", currency)
        return amount
    return round(amount / rate, 6)


def from_usd(amount_usd: float, target_currency: str) -> float:
    """Convert a USD amount to the target currency."""
    if target_currency == "USD":
        return amount_usd
    rates = get_rates()
    rate = rates.get(target_currency.upper())
    if not rate or rate == 0:
        logger.warning("Unknown currency %s — treating as USD", target_currency)
        return amount_usd
    return round(amount_usd * rate, 6)
