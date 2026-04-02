"""
Exchange rate service — fetches USD-based rates from open.er-api.com (free, no key required).
Results are cached in memory for 1 hour to avoid rate limits.

Supported currencies: USD, BOB (Bolivia), ARS (Argentina), MXN (Mexico).
"""
import time
import logging
import httpx

logger = logging.getLogger(__name__)

# Currencies supported by the app
SUPPORTED_CURRENCIES = ["USD", "BOB", "ARS", "MXN"]

# Fallback rates (1 USD = X local currency) — updated April 2026
# Used when the live API is unreachable.
_FALLBACK_RATES: dict[str, float] = {
    "USD": 1.0,
    "BOB": 6.91,
    "ARS": 1030.0,
    "MXN": 17.15,
}

_CACHE: dict[str, float] = {}
_CACHE_TS: float = 0.0
_CACHE_TTL: float = 3600.0  # 1 hour


def _fetch_rates() -> dict[str, float]:
    """Fetch latest rates from open.er-api.com (free tier, no API key)."""
    url = "https://open.er-api.com/v6/latest/USD"
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()
            rates = data.get("rates", {})
            result: dict[str, float] = {"USD": 1.0}
            for currency in SUPPORTED_CURRENCIES:
                if currency in rates:
                    result[currency] = float(rates[currency])
                else:
                    result[currency] = _FALLBACK_RATES.get(currency, 1.0)
            return result
    except Exception as exc:
        logger.warning("Exchange rate fetch failed (%s) — using fallback rates", exc)
        return dict(_FALLBACK_RATES)


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
