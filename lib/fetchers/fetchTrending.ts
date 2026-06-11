import { unstable_cache } from 'next/cache'
import { getLatestTrendingData, TrendingData } from '@/lib/supabase/queries/trending'

/**
 * Server-side fetcher for trending data.
 * Calls the DB directly (same as other fetchers) and wraps with unstable_cache
 * for 6-hour ISR-style revalidation. The live-fetch + DB-cache logic runs from
 * the /api/trending route handler when called by the frontend.
 *
 * Requirements: 5.1, 1.3
 */
export const fetchTrending = unstable_cache(
  async (): Promise<TrendingData | null> => {
    try {
      return await getLatestTrendingData()
    } catch (err) {
      console.error('Failed to fetch trending:', err)
      return null
    }
  },
  ['trending'],
  { revalidate: 21600, tags: ['trending'] }
)
