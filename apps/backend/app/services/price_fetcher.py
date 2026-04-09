"""
price_fetcher.py
================
Fetches live market prices for stocks, ETFs, metals, and crypto.
  - Stocks / ETFs / Metals / Crypto : Yahoo Finance v8 chart API (direct httpx,
                                       no crumb / no yfinance session needed)
  - Cash                             : exchange_rate.py (open.er-api.com)

All results are cached in-memory for 15 minutes.
"""
from __future__ import annotations

import logging
import time

import httpx

logger = logging.getLogger(__name__)

_CACHE: dict[str, dict] = {}   # "type:TICKER" -> {price, name, ticker, ts}
_TTL = 900                      # 15-minute cache

# Browser User-Agent so Yahoo Finance doesn't reject the request
_YF_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def get_price(ticker: str, asset_type: str) -> dict | None:
    """Return {ticker, name, price} for a given asset, using cache."""
    key = f"{asset_type}:{ticker.upper()}"
    now = time.time()
    if key in _CACHE and now - _CACHE[key]["ts"] < _TTL:
        return _CACHE[key]

    if asset_type == "cash":
        result = _fetch_cash(ticker)
    elif asset_type == "crypto":
        # Yahoo Finance uses BTC-USD format for crypto
        result = await _fetch_yf_chart(f"{ticker.upper()}-USD", display_ticker=ticker.upper())
    else:
        result = await _fetch_yf_chart(ticker.upper())

    if result:
        _CACHE[key] = {**result, "ts": now}
    return result


async def search_ticker(query: str, asset_type: str) -> list[dict]:
    if asset_type == "crypto":
        return await _search_crypto(query)
    return await _search_yf(query)


async def get_prices_bulk(holdings: list[dict]) -> dict[str, float]:
    import asyncio
    tasks = [get_price(h["ticker"], h["asset_type"]) for h in holdings]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    out: dict[str, float] = {}
    for h, r in zip(holdings, results):
        if isinstance(r, dict) and r.get("price"):
            out[h["ticker"].upper()] = r["price"]
    return out


# ---------------------------------------------------------------------------
# Yahoo Finance chart API — no crumb, no yfinance session, pure httpx
# ---------------------------------------------------------------------------

async def _fetch_yf_chart(ticker: str, display_ticker: str | None = None) -> dict | None:
    """
    Call Yahoo Finance /v8/finance/chart directly.
    This endpoint does NOT require crumb authentication, unlike quoteSummary.
    """
    sym = display_ticker or ticker.upper()
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    try:
        async with httpx.AsyncClient(timeout=10.0, headers=_YF_HEADERS) as c:
            r = await c.get(url, params={"interval": "1d", "range": "5d"})
            r.raise_for_status()
            chart = r.json().get("chart", {})
            if chart.get("error"):
                logger.warning("YF chart error for %s: %s", ticker, chart["error"])
                return None
            result_list = chart.get("result") or []
            if not result_list:
                return None
            closes = (
                result_list[0]
                .get("indicators", {})
                .get("quote", [{}])[0]
                .get("close", [])
            )
            price = next((p for p in reversed(closes) if p is not None), None)
            if price is None:
                return None
            return {"ticker": sym, "name": sym, "price": round(float(price), 4)}
    except Exception as exc:
        logger.warning("YF chart API error for %s: %s", ticker, exc)
        return None


async def _search_yf(query: str) -> list[dict]:
    results: list[dict] = []
    seen: set[str] = set()

    # 1. Exact ticker fetch — shows price immediately in the dropdown
    direct = await _fetch_yf_chart(query.upper())
    if direct:
        results.append(direct)
        seen.add(query.upper())

    # 2. Yahoo Finance search API — finds anything by name or partial ticker
    try:
        async with httpx.AsyncClient(timeout=8.0, headers=_YF_HEADERS) as c:
            r = await c.get(
                "https://query1.finance.yahoo.com/v1/finance/search",
                params={"q": query, "quotesCount": 6, "lang": "en-US", "region": "US"},
            )
            r.raise_for_status()
            for q in r.json().get("quotes", []):
                sym = q.get("symbol", "").upper()
                if not sym or sym in seen:
                    continue
                seen.add(sym)
                name = q.get("shortname") or q.get("longname") or sym
                results.append({"ticker": sym, "name": name, "price": None})
    except Exception as exc:
        logger.warning("YF search error for %s: %s", query, exc)

    return results[:6]


# ---------------------------------------------------------------------------
# Crypto search — Yahoo Finance first, CoinGecko fallback
# ---------------------------------------------------------------------------

_CG_IDS: dict[str, str] = {
    "BTC": "bitcoin", "ETH": "ethereum", "SOL": "solana",
    "BNB": "binancecoin", "XRP": "ripple", "ADA": "cardano",
    "AVAX": "avalanche-2", "DOT": "polkadot", "MATIC": "matic-network",
    "LINK": "chainlink", "LTC": "litecoin", "DOGE": "dogecoin",
    "UNI": "uniswap", "ATOM": "cosmos", "USDT": "tether",
    "USDC": "usd-coin", "SHIB": "shiba-inu", "TRX": "tron",
    "TON": "the-open-network", "NEAR": "near",
}


async def _search_crypto(query: str) -> list[dict]:
    upper = query.upper()
    # Yahoo Finance BTC-USD format — no rate limits
    direct = await _fetch_yf_chart(f"{upper}-USD", display_ticker=upper)
    if direct:
        return [direct]
    # CoinGecko search as fallback
    try:
        async with httpx.AsyncClient(timeout=6.0) as c:
            r = await c.get(
                "https://api.coingecko.com/api/v3/search",
                params={"query": query},
            )
            coins = r.json().get("coins", [])[:4]
            out = []
            for coin in coins:
                sym = coin.get("symbol", "").upper()
                _CG_IDS[sym] = coin["id"]
                out.append({"ticker": sym, "name": coin.get("name", sym), "price": None})
            return out
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Cash (fiat currencies)
# ---------------------------------------------------------------------------

_CURRENCY_NAMES: dict[str, str] = {
    "USD": "US Dollar",
    "BOB": "Bolivian Boliviano",
    "ARS": "Argentine Peso",
    "MXN": "Mexican Peso",
}


def _fetch_cash(currency: str) -> dict | None:
    from app.services.exchange_rate import to_usd
    upper = currency.upper()
    try:
        price = to_usd(1.0, upper)
        return {"ticker": upper, "name": _CURRENCY_NAMES.get(upper, upper), "price": price}
    except Exception as exc:
        logger.warning("Cash rate error for %s: %s", upper, exc)
        return {"ticker": upper, "name": _CURRENCY_NAMES.get(upper, upper), "price": None}
