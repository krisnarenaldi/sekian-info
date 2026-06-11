import { unstable_cache } from 'next/cache'
import { getLatestDailyDigestByType, DailyDigestRow } from '@/lib/supabase/queries/daily-digest'

/**
 * Server-side fetcher for daily digest data (Indonesia news).
 * Wrapped with unstable_cache for 15-minute ISR-style revalidation.
 *
 * Requirements: 2.4, 1.3
 */
export const fetchDailyDigest = unstable_cache(
  async (): Promise<DailyDigestRow[] | null> => {
    try {
      return await getLatestDailyDigestByType('indonesia')
    } catch (err) {
      console.error('Failed to fetch daily digest:', err)
      return null
    }
  },
  ['daily-digest'],
  { revalidate: 900, tags: ['daily-digest'] }
)
