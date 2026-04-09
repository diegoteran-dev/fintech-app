"""
price_fetcher.py
================
Fetches live market prices for stocks, ETFs, metals, and crypto.
  - Stocks / ETFs / Metals : Yahoo Finance via yfinance
  - Crypto                 : CoinGecko public API (no key required)

All results are cached in-memory for 15 minutes.
"""
from __future__ import annotations

import asyncio
import logging
import time

import httpx
import yfinance as yf

logger = logging.getLogger(__name__)

_CACHE: dict[str, dict] = {}   # "type:TICKER" -> {price, name, ticker, ts}
_TTL = 900                      # 15-minute cache

# ---------------------------------------------------------------------------
# Well-known CoinGecko IDs so we skip the search call for common coins
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
        result = await _fetch_crypto(ticker)
    else:
        result = await _fetch_yfinance(ticker)
    if result:
        _CACHE[key] = {**result, "ts": now}
    return result


async def search_ticker(query: str, asset_type: str) -> list[dict]:
    """
    Validate a ticker and return [{ticker, name, price}].
    Used by the frontend search box when the user types a ticker.
    """
    if asset_type == "crypto":
        return await _search_crypto(query)
    return await _search_yfinance(query)


async def get_prices_bulk(holdings: list[dict]) -> dict[str, float]:
    """
    Fetch prices for multiple holdings concurrently.
    holdings: list of {ticker, asset_type}
    Returns: {ticker: price}
    """
    tasks = [get_price(h["ticker"], h["asset_type"]) for h in holdings]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    out: dict[str, float] = {}
    for h, r in zip(holdings, results):
        if isinstance(r, dict) and r.get("price"):
            out[h["ticker"].upper()] = r["price"]
    return out


# ---------------------------------------------------------------------------
# Yahoo Finance (stocks / ETFs / metals)
# ---------------------------------------------------------------------------

async def _fetch_yfinance(ticker: str) -> dict | None:
    loop = asyncio.get_event_loop()
    try:
        def _sync() -> dict | None:
            t = yf.Ticker(ticker.upper())
            fi = t.fast_info
            # last_price is None outside market hours — fall back to previous_close
            price = fi.last_price or fi.previous_close
            if not price:
                return None
            try:
                name = t.info.get("shortName") or t.info.get("longName") or ticker.upper()
            except Exception:
                name = ticker.upper()
            return {"ticker": ticker.upper(), "name": name, "price": round(float(price), 4)}
        return await loop.run_in_executor(None, _sync)
    except Exception as exc:
        logger.warning("yfinance error for %s: %s", ticker, exc)
        return None


async def _search_yfinance(query: str) -> list[dict]:
    loop = asyncio.get_event_loop()
    try:
        def _sync_search() -> list[dict]:
            results: list[dict] = []
            seen: set[str] = set()

            # 1. Try exact ticker first so it always appears at the top
            try:
                t = yf.Ticker(query.upper())
                fi = t.fast_info
                price = fi.last_price or fi.previous_close
                if price:
                    try:
                        name = t.info.get("shortName") or t.info.get("longName") or query.upper()
                    except Exception:
                        name = query.upper()
                    results.append({"ticker": query.upper(), "name": name, "price": round(float(price), 4)})
                    seen.add(query.upper())
            except Exception:
                pass

            # 2. yf.Search finds anything on the market — partial names, ETFs, funds, etc.
            try:
                for item in yf.Search(query, max_results=6).quotes:
                    sym = item.get("symbol", "").upper()
                    if not sym or sym in seen:
                        continue
                    seen.add(sym)
                    name = item.get("shortname") or item.get("longname") or sym
                    results.append({"ticker": sym, "name": name, "price": None})
            except Exception:
                pass

            return results[:6]

        return await loop.run_in_executor(None, _sync_search)
    except Exception as exc:
        logger.warning("yfinance search error for %s: %s", query, exc)
        return []


# ---------------------------------------------------------------------------
# CoinGecko (crypto)
# ---------------------------------------------------------------------------

async def _fetch_crypto(ticker: str) -> dict | None:
    upper = ticker.upper()
    # Primary: yfinance with BTC-USD format — no rate limits, same lib
    yf_result = await _fetch_yfinance(f"{upper}-USD")
    if yf_result:
        return {**yf_result, "ticker": upper}

    # Fallback: CoinGecko
    coin_id = await _resolve_cg_id(ticker)
    if not coin_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0) as c:
            r = await c.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={"ids": coin_id, "vs_currencies": "usd"},
            )
            r.raise_for_status()
            price = r.json().get(coin_id, {}).get("usd")
            if price is None:
                return None
            return {"ticker": upper, "name": upper, "price": float(price)}
    except Exception as exc:
        logger.warning("CoinGecko error for %s: %s", ticker, exc)
        return None


async def _search_crypto(query: str) -> list[dict]:
    upper = query.upper()
    # Try direct fetch first (covers well-known tickers)
    result = await _fetch_crypto(upper)
    if result:
        return [result]
    # Fall back to CoinGecko search
    try:
        async with httpx.AsyncClient(timeout=6.0) as c:
            r = await c.get("https://api.coingecko.com/api/v3/search", params={"query": query})
            coins = r.json().get("coins", [])[:4]
            out = []
            for coin in coins:
                sym = coin.get("symbol", "").upper()
                _CG_IDS[sym] = coin["id"]
                price_r = await c.get(
                    "https://api.coingecko.com/api/v3/simple/price",
                    params={"ids": coin["id"], "vs_currencies": "usd"},
                ) if not out else None  # only fetch price for first result
                price = (
                    price_r.json().get(coin["id"], {}).get("usd") if price_r else None
                )
                out.append({"ticker": sym, "name": coin.get("name", sym), "price": price})
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


async def _resolve_cg_id(ticker: str) -> str | None:
    upper = ticker.upper()
    if upper in _CG_IDS:
        return _CG_IDS[upper]
    try:
        async with httpx.AsyncClient(timeout=6.0) as c:
            r = await c.get("https://api.coingecko.com/api/v3/search", params={"query": ticker})
            coins = r.json().get("coins", [])
            if coins:
                cid = coins[0]["id"]
                _CG_IDS[upper] = cid
                return cid
    except Exception:
        pass
    return None
