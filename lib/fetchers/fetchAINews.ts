import { unstable_cache } from 'next/cache'
import { getLatestAINewsDigest, AINewsDigestRow } from '@/lib/supabase/queries/ai-news'

/**
 * Server-side fetcher for AI news digest data.
 * Wrapped with unstable_cache for 15-minute ISR-style revalidation.
 *
 * Requirements: 4.3, 1.3
 */
export const fetchAINews = unstable_cache(
  async (): Promise<AINewsDigestRow | null> => {
    try {
      return await getLatestAINewsDigest()
    } catch (err) {
      console.error('Failed to fetch AI news:', err)
      return null
    }
  },
  ['ai-news'],
  { revalidate: 900, tags: ['ai-news'] }
)
