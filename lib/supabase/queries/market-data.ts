/**
 * Supabase query functions for the `market_data` table.
 *
 * Functions:
 * - `getMarketData(date)` — fetch market data for a specific date
 * - `getMarketDataRange(startDate, endDate)` — fetch market data for a date range
 * - `upsertMarketData(date, data)` — upsert market data for a given date
 * - `getLatestMarketData()` — fetch the most recent market data row
 *
 * Requirements: 3.1, 9.5, 12.2, 13.4
 */

import { createServerClient } from '../client'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Represents a single stock entry in top_gainer / top_loser arrays */
export interface StockItem {
  code: string
  name: string
  change_pct: number
}

/** Fields that can be written when upserting market data */
export interface MarketDataInput {
  ihsg?: number | null
  ihsg_change?: number | null
  usd_idr?: number | null
  gold_price?: number | null
  top_gainer?: StockItem[] | null
  top_loser?: StockItem[] | null
  ai_insight?: string | null
}

/** Full row as returned from the database */
export interface MarketDataRow {
  id: string
  date: string
  ihsg: number | null
  ihsg_change: number | null
  usd_idr: number | null
  gold_price: number | null
  top_gainer: StockItem[] | null
  top_loser: StockItem[] | null
  ai_insight: string | null
  created_at: string
}

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Fetch market data for the given date (ISO format: "YYYY-MM-DD").
 * Returns `null` if no row exists for that date.
 */
export async function getMarketData(date: string): Promise<MarketDataRow | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('market_data')
    .select('*')
    .eq('date', date)
    .maybeSingle()

  if (error) {
    throw new Error(`getMarketData failed for date "${date}": ${error.message}`)
  }

  return data as MarketDataRow | null
}

/**
 * Fetch market data for a date range (inclusive), ordered by date ascending.
 * Returns an empty array if no rows exist in the range.
 *
 * @param startDate - ISO date string (inclusive, e.g. "2026-05-14")
 * @param endDate   - ISO date string (inclusive, e.g. "2026-06-13")
 */
export async function getMarketDataRange(
  startDate: string,
  endDate: string
): Promise<MarketDataRow[]> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('market_data')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (error) {
    throw new Error(
      `getMarketDataRange failed for "${startDate}".."${endDate}": ${error.message}`
    )
  }

  return (data ?? []) as MarketDataRow[]
}

/**
 * Upsert market data for the given date.
 * Uses `onConflict: 'date'` so duplicate dates update the existing row.
 *
 * @param date - ISO date string ("YYYY-MM-DD")
 * @param data - market data fields to write
 * @returns the upserted row
 */
export async function upsertMarketData(
  date: string,
  data: MarketDataInput
): Promise<MarketDataRow> {
  const supabase = createServerClient()

  const { data: row, error } = await supabase
    .from('market_data')
    .upsert(
      { date, ...data },
      { onConflict: 'date' }
    )
    .select()
    .single()

  if (error) {
    throw new Error(`upsertMarketData failed for date "${date}": ${error.message}`)
  }

  return row as MarketDataRow
}

/**
 * Fetch the most recent market data row, ordered by date descending.
 * Returns `null` if the table is empty.
 */
export async function getLatestMarketData(): Promise<MarketDataRow | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('market_data')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`getLatestMarketData failed: ${error.message}`)
  }

  return data as MarketDataRow | null
}