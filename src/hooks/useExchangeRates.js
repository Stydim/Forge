import { useEffect, useState } from 'react';
import { CURRENCIES } from '../lib/subscriptions';

// Currency rates for the subscriptions totals (ported from Sanct): the free
// fawazahmed0 currency API (no key, CORS-friendly), cached for an hour.
const CACHE_KEY = 'forge:exchange-rates';
const CACHE_TTL = 60 * 60 * 1000;
const URLS = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json',
  'https://latest.currency-api.pages.dev/v1/currencies/eur.json',
];
const CODES = Object.fromEntries(CURRENCIES.map((c) => [c.symbol, c.code]));

function readCache() {
  try {
    const { ts, data } = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (Date.now() - ts < CACHE_TTL) return data;
  } catch { /* no cache */ }
  return null;
}

export function useExchangeRates() {
  const [rates, setRates] = useState(readCache);
  const [loading, setLoading] = useState(!rates);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (rates) return;
    let cancelled = false;
    (async () => {
      for (const url of URLS) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const json = await res.json();
          // { date, eur: { usd: 1.08, rub: 99.5, ... } } — rates per 1 EUR.
          const data = { EUR: 1 };
          for (const [code, val] of Object.entries(json.eur || {})) data[code.toUpperCase()] = val;
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch { /* full */ }
          if (!cancelled) { setRates(data); setLoading(false); }
          return;
        } catch { /* try the next mirror */ }
      }
      if (!cancelled) { setError('no rates'); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [rates]);

  // Converts between currency symbols; unknown currencies stay as they are.
  const convert = (amount, from, to) => {
    if (!rates || from === to) return amount;
    const f = rates[CODES[from]];
    const t = rates[CODES[to]];
    return f && t ? (amount / f) * t : amount;
  };

  return { loading, error, convert };
}
