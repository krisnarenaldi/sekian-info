/**
 * POST /api/cron/market — Pipeline Pasar Hari Ini
 *
 * Runs the daily market data pipeline:
 *   1. Validate CRON_SECRET from Authorization header
 *   2. Fetch market data (IHSG, USD/IDR, gold, top movers)
 *   3. Generate LLM insight via summarizeMarket
 *   4. Upsert results into the `market_data` table
 *
 * Individual API source failures are handled gracefully inside fetchMarketData
 * (each source resolves independently). LLM and DB failures are caught here
 * and returned as error responses.
 *
 * Requirements: 9.1, 9.2–9.6, 11.1
 */

import { NextResponse } from 'next/server'
import { fetchMarketData } from '@/lib/pipeline/market-fetcher'
import { summarizeMarket } from '@/lib/pipeline/llm-summarizer'
import { upsertMarketData } from '@/lib/supabase/queries/market-data'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger('cron-market')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns today's date in WIB (UTC+7) as an ISO date string "YYYY-MM-DD".
 */
function getTodayWIB(): string {
  const now = new Date()
  // Offset to WIB (UTC+7)
  const wibOffset = 7 * 60 * 60 * 1000
  const wibDate = new Date(now.getTime() + wibOffset)
  return wibDate.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request): Promise<NextResponse> {
  // ── 1. Validate CRON_SECRET ──────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    log.warn('Unauthorized request to /api/cron/market — invalid or missing CRON_SECRET')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = getTodayWIB()
  log.info(`Pipeline started for date ${date}`)

  // ── 2. Fetch market data ─────────────────────────────────────────────────
  // fetchMarketData isolates each source internally; partial data is returned
  // even when some sources fail (per Requirement 9.6).
  log.info('Fetching market data')
  const marketData = await fetchMarketData()
  log.info(
    `Market data fetched — IHSG: ${marketData.ihsg ?? 'N/A'}, ` +
      `USD/IDR: ${marketData.usd_idr ?? 'N/A'}, ` +
      `Gold: ${marketData.gold_price ?? 'N/A'}`,
  )

  // ── 3. Generate LLM insight ──────────────────────────────────────────────
  // Per Requirement 11.1: LLM is called only from the cron pipeline, not from
  // user-facing requests.
  let aiInsight: string | null = null

  try {
    log.info('Calling LLM summarizer for market insight')
    aiInsight = await summarizeMarket(marketData)
    log.info('LLM insight generated successfully')
  } catch (err) {
    // Requirement 14.1 & 14.2: log every LLM failure with pipeline context.
    log.error('LLM summarizeMarket failed — proceeding without insight', err)
    // aiInsight stays null; the row is still saved with whatever data we have.
  }

  // ── 4. Upsert to market_data table ───────────────────────────────────────
  try {
    log.info(`Upserting market data to DB for date ${date}`)
    await upsertMarketData(date, {
      ihsg: marketData.ihsg,
      ihsg_change: marketData.ihsg_change,
      usd_idr: marketData.usd_idr,
      gold_price: marketData.gold_price,
      top_gainer: marketData.top_gainer,
      top_loser: marketData.top_loser,
      ai_insight: aiInsight,
    })
    log.info('Market data saved to DB successfully')
    
    // Invalidate Next.js cache so the new data & insight display immediately
    const { revalidateTag } = await import('next/cache')
    revalidateTag('market-data', 'max')
    log.info('Market data cache tag invalidated')
  } catch (err) {
    log.error('Failed to upsert market data to DB', err)
    return NextResponse.json(
      { error: 'Failed to save market data', details: String(err) },
      { status: 500 },
    )
  }

  log.info('Pipeline completed successfully')

  return NextResponse.json({
    success: true,
    date,
    data: {
      ihsg: marketData.ihsg,
      ihsg_change: marketData.ihsg_change,
      usd_idr: marketData.usd_idr,
      gold_price: marketData.gold_price,
      top_gainer: marketData.top_gainer,
      top_loser: marketData.top_loser,
      ai_insight: aiInsight,
    },
  })
}
