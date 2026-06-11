import { unstable_cache } from 'next/cache'
import { getLatestMarketData, MarketDataRow } from '@/lib/supabase/queries/market-data'

/**
 * Server-side fetcher for market data.
 * Wrapped with unstable_cache for 15-minute ISR-style revalidation.
 *
 * Requirements: 3.4, 1.3
 */
export const fetchMarketData = unstable_cache(
  async (): Promise<MarketDataRow | null> => {
    try {
      return await getLatestMarketData()
    } catch (err) {
      console.error('Failed to fetch market data:', err)
      return null
    }
  },
  ['market-data'],
  { revalidate: 900, tags: ['market-data'] }
)
