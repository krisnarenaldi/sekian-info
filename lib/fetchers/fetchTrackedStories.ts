import { unstable_cache } from 'next/cache'
import { getActiveStoriesForHomepage, StoryWithMetrics } from '@/lib/supabase/queries/stories'

/**
 * Server-side fetcher for active tracked stories data.
 * Wrapped with unstable_cache for 15-minute ISR-style revalidation.
 *
 * Returns `StoryWithMetrics[]` if data exists, `null` if no data or error.
 * `null` return signals the frontend to hide the "Sedang Berkembang" card entirely.
 *
 * Requirements: 6.1, 6.3, 6.4, 9.3, 9.5
 */
export const fetchTrackedStories = unstable_cache(
  async (): Promise<StoryWithMetrics[] | null> => {
    try {
      const data = await getActiveStoriesForHomepage(5)
      return data.length > 0 ? data : null
    } catch (err) {
      console.error('Failed to fetch tracked stories:', err)
      return null  // null = hide the card, consistent with existing pattern
    }
  },
  ['tracked-stories'],
  { revalidate: 900, tags: ['tracked-stories'] }
)