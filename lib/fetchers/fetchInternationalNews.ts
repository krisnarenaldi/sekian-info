import { unstable_cache } from 'next/cache'
import { getLatestDailyDigestByType, DailyDigestRow } from '@/lib/supabase/queries/daily-digest'

/**
 * Server-side fetcher for international news digest data.
 * Wrapped with unstable_cache for 15-minute ISR-style revalidation.
 */
export const fetchInternationalNews = unstable_cache(
  async (): Promise<DailyDigestRow[] | null> => {
    try {
      return await getLatestDailyDigestByType('international')
    } catch (err) {
      console.error('Failed to fetch international news:', err)
      return null
    }
  },
  ['daily-digest-international'],
  { revalidate: 900, tags: ['daily-digest'] }
)
