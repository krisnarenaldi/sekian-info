import { unstable_cache } from 'next/cache'
import { getLatestDailyDigestByType, DailyDigestRow } from '@/lib/supabase/queries/daily-digest'

/**
 * Server-side fetcher for sport news digest data.
 * Wrapped with unstable_cache for 15-minute ISR-style revalidation.
 *
 * Requirements: 2.4, 1.3
 */
export const fetchSportNews = unstable_cache(
  async (): Promise<DailyDigestRow[] | null> => {
    try {
      return await getLatestDailyDigestByType('sport')
    } catch (err) {
      console.error('Failed to fetch sport news:', err)
      return null
    }
  },
  ['daily-digest-sport'],
  { revalidate: 900, tags: ['daily-digest'] }
)
