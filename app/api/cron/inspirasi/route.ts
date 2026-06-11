/**
 * POST /api/cron/inspirasi
 *
 * Cron handler for the Inspirasi Harian daily selection pipeline.
 * Scheduled at 00:05 WIB (17:05 UTC) via vercel.json.
 *
 * Pipeline logic:
 * 1. Validate CRON_SECRET from Authorization header (Bearer token).
 * 2. Determine today's date in WIB (UTC+7).
 * 3. Check if an inspirasi item has already been selected for today — return early
 *    if so (idempotent).
 * 4. Pick a random unselected item (selected_date IS NULL).
 * 5. If no unselected items remain, reset all selected_date values and pick again.
 * 6. Mark the chosen item with today's date via updateSelectedDate.
 * 7. Return the selected item as JSON.
 *
 * Requirements: 6.2, 6.3
 */

import { NextResponse } from 'next/server'
import {
  getInspirasiByDate,
  pickRandomInspirasi,
  updateSelectedDate,
  resetAllSelectedDates,
} from '@/lib/supabase/queries/inspirasi'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger('inspirasi')

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return today's date in WIB (UTC+7) as an ISO date string "YYYY-MM-DD".
 */
function getTodayWIB(): string {
  const now = new Date()
  // Shift to WIB by adding 7 hours worth of milliseconds
  const wibOffset = 7 * 60 * 60 * 1000
  const wibDate = new Date(now.getTime() + wibOffset)
  // toISOString produces "YYYY-MM-DDTHH:mm:ss.sssZ" — take the date portion
  return wibDate.toISOString().slice(0, 10)
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<NextResponse> {
  // ── 1. Validate CRON_SECRET ────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  const expectedToken = process.env.CRON_SECRET

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    log.warn('Unauthorized request — invalid or missing CRON_SECRET')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Determine today's date in WIB ───────────────────────────────────────
  const today = getTodayWIB()
  log.info(`Pipeline started for date ${today}`)

  try {
    // ── 3. Idempotency check — already selected today? ──────────────────────
    const existing = await getInspirasiByDate(today)

    if (existing) {
      log.info(`Inspirasi already selected for ${today} (id: ${existing.id}), skipping`)
      return NextResponse.json({
        message: 'Already selected for today',
        data: existing,
      })
    }

    // ── 4. Pick a random unselected item ────────────────────────────────────
    log.info('Picking random inspirasi from unselected pool')
    let candidate = await pickRandomInspirasi(true /* whereNull = true */)

    // ── 5. Pool exhausted — reset and pick again ─────────────────────────────
    if (!candidate) {
      log.info('Unselected pool is empty — resetting all selected_date values')
      const resetCount = await resetAllSelectedDates()
      log.info(`Reset ${resetCount} rows, picking from full pool`)

      candidate = await pickRandomInspirasi(false)

      if (!candidate) {
        // Table is completely empty — nothing to select
        log.warn('inspirasi_harian table is empty, cannot select any item')
        return NextResponse.json(
          { error: 'No inspirasi content available' },
          { status: 404 },
        )
      }
    }

    // ── 6. Mark the chosen item with today's date ────────────────────────────
    log.info(`Marking inspirasi id ${candidate.id} as selected for ${today}`)
    const updated = await updateSelectedDate(candidate.id, today)

    log.info(`Pipeline completed — selected id ${updated.id} (type: ${updated.type})`)

    // ── 7. Return the selected item ──────────────────────────────────────────
    return NextResponse.json({
      message: 'Inspirasi selected successfully',
      data: updated,
    })
  } catch (err) {
    log.error('Pipeline failed with unexpected error', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
