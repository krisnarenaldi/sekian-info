/**
 * Market Fetcher — fetches live market data for the dashboard widget.
 *
 * Data sources:
 *   - IHSG (^JKSE) via Yahoo Finance chart API
 *   - USD/IDR exchange rate via open.er-api.com (with exchangerate.host as primary)
 *   - Gold price (GC=F, XAU/USD) via Yahoo Finance, converted to IDR/gram
 *   - Top gainer / loser via Yahoo Finance screener (optional, may return null)
 *
 * Each data source is fetched independently. If one fails, it is logged and
 * the rest of the fetch continues — partial data is preferred over no data.
 *
 * Requirements: 9.2, 9.3, 9.6
 */

import { createLogger } from '../utils/logger'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0' }

/** Troy ounce to grams conversion factor. */
const TROY_OZ_TO_GRAMS = 31.1035

/** Fallback USD/IDR rate when exchange-rate fetch fails. */
const FALLBACK_USD_IDR = 16_000

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StockMover {
  code: string
  name: string
  change_pct: number
}

export interface MarketDataResult {
  ihsg: number | null
  ihsg_change: number | null
  usd_idr: number | null
  gold_price: number | null
  top_gainer: StockMover[] | null
  top_loser: StockMover[] | null
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const log = createLogger('market-fetcher')

/**
 * Fetch IHSG (^JKSE) current price and daily change % from Yahoo Finance.
 * Returns [price, change_pct] or throws on failure.
 */
async function fetchIHSG(): Promise<[number, number]> {
  const url =
    'https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?interval=1d&range=1d'

  const res = await fetch(url, { headers: YAHOO_HEADERS })
  if (!res.ok) {
    throw new Error(`Yahoo Finance IHSG responded with HTTP ${res.status}`)
  }

  const json = await res.json()
  const meta = json?.chart?.result?.[0]?.meta

  if (meta == null) {
    throw new Error('Unexpected IHSG response structure — missing meta')
  }

  const price: number = meta.regularMarketPrice
  const prevClose: number = meta.chartPreviousClose

  if (typeof price !== 'number' || typeof prevClose !== 'number' || prevClose === 0) {
    throw new Error('IHSG meta missing regularMarketPrice or chartPreviousClose')
  }

  const changePct = ((price - prevClose) / prevClose) * 100
  return [price, changePct]
}

/**
 * Fetch USD/IDR exchange rate.
 * Tries exchangerate.host first; falls back to open.er-api.com on error.
 */
async function fetchUSDIDR(): Promise<number> {
  // Primary: exchangerate.host
  try {
    const res = await fetch(
      'https://api.exchangerate.host/latest?base=USD&symbols=IDR',
    )
    if (res.ok) {
      const json = await res.json()
      const rate: unknown = json?.rates?.IDR
      if (typeof rate === 'number' && rate > 0) {
        return rate
      }
      // exchangerate.host returned a non-error HTTP status but bad payload
      // (e.g. requires API key and returns {"success":false})
      log.warn('exchangerate.host returned invalid rate, trying fallback')
    } else {
      log.warn(`exchangerate.host HTTP ${res.status}, trying fallback`)
    }
  } catch (err) {
    log.warn('exchangerate.host fetch failed, trying fallback', err)
  }

  // Fallback: open.er-api.com (free, no key required)
  const res = await fetch('https://open.er-api.com/v6/latest/USD')
  if (!res.ok) {
    throw new Error(`open.er-api.com responded with HTTP ${res.status}`)
  }

  const json = await res.json()
  const rate: unknown = json?.rates?.IDR
  if (typeof rate !== 'number' || rate <= 0) {
    throw new Error('open.er-api.com missing or invalid IDR rate')
  }

  return rate
}

/**
 * Fetch gold price in IDR per gram.
 * Uses Yahoo Finance GC=F (front-month gold futures in USD/troy-oz)
 * and converts using the provided USD/IDR rate.
 */
async function fetchGoldPrice(usdIdr: number): Promise<number> {
  const url =
    'https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=1d'

  const res = await fetch(url, { headers: YAHOO_HEADERS })
  if (!res.ok) {
    throw new Error(`Yahoo Finance GC=F responded with HTTP ${res.status}`)
  }

  const json = await res.json()
  const meta = json?.chart?.result?.[0]?.meta

  if (meta == null) {
    throw new Error('Unexpected gold response structure — missing meta')
  }

  const priceUsdPerTroyOz: number = meta.regularMarketPrice
  if (typeof priceUsdPerTroyOz !== 'number' || priceUsdPerTroyOz <= 0) {
    throw new Error('Gold meta missing regularMarketPrice')
  }

  const priceIdrPerGram = (priceUsdPerTroyOz / TROY_OZ_TO_GRAMS) * usdIdr
  return priceIdrPerGram
}

/**
 * Fetch top gainers and losers for Indonesian stocks via Yahoo Finance screener.
 * This is optional — returns null on any failure.
 */
async function fetchTopMovers(): Promise<{
  gainers: StockMover[]
  losers: StockMover[]
} | null> {
  const baseUrl =
    'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved'
  const params = 'formatted=false&count=5&region=ID&lang=id-ID'

  async function fetchScreener(scrId: string): Promise<StockMover[] | null> {
    const url = `${baseUrl}?${params}&scrIds=${scrId}`
    const res = await fetch(url, { headers: YAHOO_HEADERS })
    if (!res.ok) return null

    const json = await res.json()
    const quotes: unknown[] =
      json?.finance?.result?.[0]?.quotes ?? []

    if (!Array.isArray(quotes) || quotes.length === 0) return null

    return quotes
      .map((q) => {
        const quote = q as Record<string, unknown>
        return {
          code: String(quote['symbol'] ?? ''),
          name: String(quote['longName'] ?? quote['shortName'] ?? ''),
          change_pct:
            typeof quote['regularMarketChangePercent'] === 'number'
              ? quote['regularMarketChangePercent']
              : 0,
        }
      })
      .filter((m) => m.code !== '')
  }

  const [gainers, losers] = await Promise.all([
    fetchScreener('day_gainers'),
    fetchScreener('day_losers'),
  ])

  if (gainers === null && losers === null) return null

  return {
    gainers: gainers ?? [],
    losers: losers ?? [],
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all market data in parallel.
 *
 * Each source is isolated: if one throws, the error is logged and the
 * corresponding field is set to null. The function always resolves.
 *
 * Requirements: 9.2 (IHSG), 9.3 (USD/IDR, gold), 9.6 (error isolation)
 */
export async function fetchMarketData(): Promise<MarketDataResult> {
  let ihsg: number | null = null
  let ihsgChange: number | null = null
  let usdIdr: number | null = null
  let goldPrice: number | null = null
  let topGainer: StockMover[] | null = null
  let topLoser: StockMover[] | null = null

  // Fetch IHSG
  try {
    const [price, changePct] = await fetchIHSG()
    ihsg = price
    ihsgChange = changePct
    log.info(`IHSG fetched: ${price.toFixed(2)} (${changePct.toFixed(2)}%)`)
  } catch (err) {
    log.error('Failed to fetch IHSG', err)
  }

  // Fetch USD/IDR
  try {
    usdIdr = await fetchUSDIDR()
    log.info(`USD/IDR fetched: ${usdIdr.toFixed(2)}`)
  } catch (err) {
    log.error('Failed to fetch USD/IDR', err)
  }

  // Fetch gold price (uses fetched USD/IDR or fallback)
  try {
    const effectiveUsdIdr = usdIdr ?? FALLBACK_USD_IDR
    goldPrice = await fetchGoldPrice(effectiveUsdIdr)
    log.info(`Gold price fetched: IDR ${goldPrice.toFixed(0)}/gram`)
  } catch (err) {
    log.error('Failed to fetch gold price', err)
  }

  // Fetch top movers (optional — failures are silent beyond a warn)
  try {
    const movers = await fetchTopMovers()
    if (movers !== null) {
      topGainer = movers.gainers.length > 0 ? movers.gainers : null
      topLoser = movers.losers.length > 0 ? movers.losers : null
      log.info(
        `Top movers fetched: ${movers.gainers.length} gainers, ${movers.losers.length} losers`,
      )
    }
  } catch (err) {
    log.warn('Failed to fetch top movers (optional)', err)
  }

  return {
    ihsg,
    ihsg_change: ihsgChange,
    usd_idr: usdIdr,
    gold_price: goldPrice,
    top_gainer: topGainer,
    top_loser: topLoser,
  }
}
