/**
 * Supabase query functions for the `trending_data` table.
 *
 * Functions:
 * - `getTrendingData(date)` — fetch trending data for a specific date
 * - `upsertTrendingData(date, topics)` — upsert trending data for a given date
 * - `getLatestTrendingData()` — fetch the most recent trending data row
 *
 * Requirements: 5.1, 12.6
 */

import { createServerClient } from '../client'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Represents a single trending topic entry */
export interface TrendingTopic {
  keyword: string
  search_volume?: number | null
}

/** Full row as returned from the database */
export interface TrendingData {
  id: string
  date: string
  topics: TrendingTopic[]
  created_at: string
}

/** @deprecated Use `TrendingData` instead */
export type TrendingDataRow = TrendingData

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Fetch trending data for the given date (ISO format: "YYYY-MM-DD").
 * Returns `null` if no row exists for that date.
 */
export async function getTrendingData(date: string): Promise<TrendingData | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('trending_data')
    .select('*')
    .eq('date', date)
    .maybeSingle()

  if (error) {
    throw new Error(`getTrendingData failed for date "${date}": ${error.message}`)
  }

  return data as TrendingData | null
}

/**
 * Upsert trending data for the given date.
 * Uses `onConflict: 'date'` so duplicate dates update the existing row.
 *
 * @param date - ISO date string ("YYYY-MM-DD")
 * @param topics - array of trending topic objects
 * @returns the upserted row
 */
export async function upsertTrendingData(
  date: string,
  topics: TrendingTopic[]
): Promise<TrendingData> {
  const supabase = createServerClient()

  const { data: row, error } = await supabase
    .from('trending_data')
    .upsert(
      { date, topics },
      { onConflict: 'date' }
    )
    .select()
    .single()

  if (error) {
    throw new Error(`upsertTrendingData failed for date "${date}": ${error.message}`)
  }

  return row as TrendingData
}

/**
 * Fetch the most recent trending data row, ordered by date descending.
 * Returns `null` if the table is empty.
 */
export async function getLatestTrendingData(): Promise<TrendingData | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('trending_data')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`getLatestTrendingData failed: ${error.message}`)
  }

  return data as TrendingData | null
}
