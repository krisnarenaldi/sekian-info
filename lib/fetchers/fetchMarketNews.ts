import { unstable_cache } from 'next/cache'
import { getLatestDailyDigestByType, DailyDigestRow } from '@/lib/supabase/queries/daily-digest'

/**
 * Server-side fetcher for market/investment news digest data.
 * Wrapped with unstable_cache for 15-minute ISR-style revalidation.
 */
export const fetchMarketNews = unstable_cache(
  async (): Promise<DailyDigestRow[] | null> => {
    try {
      return await getLatestDailyDigestByType('market')
    } catch (err) {
      console.error('Failed to fetch market news:', err)
      return null
    }
  },
  ['daily-digest-market'],
  { revalidate: 900, tags: ['daily-digest'] }
)