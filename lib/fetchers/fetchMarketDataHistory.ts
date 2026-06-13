import { unstable_cache } from 'next/cache'
import { getMarketDataRange, MarketDataRow } from '@/lib/supabase/queries/market-data'

/**
 * Server-side fetcher for historical market data across a date range.
 * Wrapped with unstable_cache for 15-minute ISR-style revalidation.
 *
 * Returns rows sorted by date ascending (oldest first).
 */
export const fetchMarketDataHistory = unstable_cache(
  async (startDate: string, endDate: string): Promise<MarketDataRow[]> => {
    try {
      return await getMarketDataRange(startDate, endDate)
    } catch (err) {
      console.error('Failed to fetch market data history:', err)
      return []
    }
  },
  ['market-data-history'],
  { revalidate: 900, tags: ['market-data'] }
)

/**
 * Helper to produce ISO date strings for the last N days (inclusive of today).
 */
export function getDateRange(days: number): { startDate: string; endDate: string } {
  const now = new Date()
  const wibOffset = 7 * 60 * 60 * 1000
  const end = new Date(now.getTime() + wibOffset)
  const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000)

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}