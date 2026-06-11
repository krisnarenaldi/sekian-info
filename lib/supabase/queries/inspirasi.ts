/**
 * Supabase query functions for the `inspirasi_harian` table.
 *
 * Functions:
 * - `getInspirasiByDate(date)` — fetch the inspirasi item selected for a given date
 * - `pickRandomInspirasi(whereNull?)` — pick a random inspirasi item, optionally only from unselected pool
 * - `updateSelectedDate(id, date)` — mark an item as selected for a given date
 * - `resetAllSelectedDates()` — clear all selected_date values (reset the pool)
 *
 * Random selection strategy: Supabase client does not expose a native RANDOM() order,
 * so we fetch all matching IDs, pick one randomly in JS, then fetch that specific row.
 * This keeps the query parameterized and avoids SQL injection.
 *
 * Requirements: 6.1, 6.2, 6.3, 12.4
 */

import { createServerClient } from '../client'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Full row as returned from the `inspirasi_harian` table */
export interface InspirasiItem {
  id: string
  type: 'quran' | 'hadits' | 'quote'
  content: string
  reference: string | null
  selected_date: string | null
}

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Fetch the inspirasi item whose `selected_date` equals the given date.
 * Returns `null` if no item has been selected for that date yet.
 *
 * @param date - ISO date string ("YYYY-MM-DD")
 */
export async function getInspirasiByDate(date: string): Promise<InspirasiItem | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('inspirasi_harian')
    .select('*')
    .eq('selected_date', date)
    .maybeSingle()

  if (error) {
    throw new Error(`getInspirasiByDate failed for date "${date}": ${error.message}`)
  }

  return data as InspirasiItem | null
}

/**
 * Pick a random inspirasi item.
 *
 * When `whereNull` is `true`, only items with `selected_date IS NULL` are considered
 * (the unselected pool). When `false` or omitted, all items are eligible.
 *
 * Random selection is done in JavaScript to avoid native SQL RANDOM() limitations:
 * 1. Fetch all matching `id` values.
 * 2. Pick one at random.
 * 3. Fetch and return that specific row.
 *
 * Returns `null` if the pool is empty.
 *
 * @param whereNull - when `true`, restrict to unselected items only
 */
export async function pickRandomInspirasi(whereNull = false): Promise<InspirasiItem | null> {
  const supabase = createServerClient()

  // Step 1: Fetch all matching IDs
  let query = supabase.from('inspirasi_harian').select('id')

  if (whereNull) {
    query = query.is('selected_date', null)
  }

  const { data: ids, error: idsError } = await query

  if (idsError) {
    throw new Error(`pickRandomInspirasi failed while fetching IDs: ${idsError.message}`)
  }

  if (!ids || ids.length === 0) {
    return null
  }

  // Step 2: Pick a random ID in JavaScript
  const randomIndex = Math.floor(Math.random() * ids.length)
  const selectedId = ids[randomIndex].id

  // Step 3: Fetch the full row for the selected ID
  const { data: row, error: rowError } = await supabase
    .from('inspirasi_harian')
    .select('*')
    .eq('id', selectedId)
    .single()

  if (rowError) {
    throw new Error(`pickRandomInspirasi failed while fetching row id "${selectedId}": ${rowError.message}`)
  }

  return row as InspirasiItem
}

/**
 * Set `selected_date` on the inspirasi item with the given ID.
 * Used by the cron job to mark today's chosen content.
 *
 * @param id   - UUID of the inspirasi item
 * @param date - ISO date string ("YYYY-MM-DD")
 * @returns the updated row
 */
export async function updateSelectedDate(id: string, date: string): Promise<InspirasiItem> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('inspirasi_harian')
    .update({ selected_date: date })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`updateSelectedDate failed for id "${id}": ${error.message}`)
  }

  return data as InspirasiItem
}

/**
 * Reset `selected_date` to `null` for all rows in `inspirasi_harian`.
 * Called when the entire pool has been exhausted so selection can restart.
 *
 * @returns the number of rows updated
 */
export async function resetAllSelectedDates(): Promise<number> {
  const supabase = createServerClient()

  // Supabase requires at least one filter on update; use a match-all workaround
  // by filtering on a column that is never null (the primary key is always present).
  const { data, error } = await supabase
    .from('inspirasi_harian')
    .update({ selected_date: null })
    .not('id', 'is', null)
    .select('id')

  if (error) {
    throw new Error(`resetAllSelectedDates failed: ${error.message}`)
  }

  return data?.length ?? 0
}
