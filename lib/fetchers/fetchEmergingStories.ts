import { unstable_cache } from 'next/cache'
import { getEmergingStories, type EmergingStory } from '@/lib/supabase/queries/stories'

/**
 * Server-side fetcher for emerging stories data.
 * Wrapped with unstable_cache for 15-minute ISR-style revalidation.
 */
export const fetchEmergingStories = unstable_cache(
  async (): Promise<EmergingStory[] | null> => {
    try {
      return await getEmergingStories()
    } catch (err) {
      console.error('Failed to fetch emerging stories:', err)
      return null
    }
  },
  ['emerging-stories'],
  { revalidate: 900, tags: ['emerging-stories'] }
)
