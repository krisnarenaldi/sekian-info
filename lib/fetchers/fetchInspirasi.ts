import { unstable_cache } from 'next/cache'
import { getInspirasiByDate, InspirasiItem } from '@/lib/supabase/queries/inspirasi'

function getTodayWIB(): string {
  const now = new Date()
  const wibOffset = 7 * 60 * 60 * 1000
  const wibDate = new Date(now.getTime() + wibOffset)
  return wibDate.toISOString().slice(0, 10)
}

/**
 * Server-side fetcher for today's inspirasi content (WIB timezone).
 * Wrapped with unstable_cache for 15-minute ISR-style revalidation.
 *
 * Throws on DB/network error so callers can distinguish:
 *   - resolved `null`  → no inspirasi data exists in DB (hide card)
 *   - rejected (throw) → data was expected but failed to load (show error)
 *
 * Requirements: 6.1, 6.4, 6.5, 1.3
 */
export const fetchInspirasi = unstable_cache(
  async (): Promise<InspirasiItem | null> => {
    // Let errors propagate — callers handle the error state themselves.
    return await getInspirasiByDate(getTodayWIB())
  },
  ['inspirasi'],
  { revalidate: 900, tags: ['inspirasi'] }
)
