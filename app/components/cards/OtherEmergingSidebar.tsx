import Link from 'next/link'
import { fetchEmergingStories } from '@/lib/fetchers/fetchEmergingStories'

type Props = {
  currentStoryId: string
}

export default async function OtherEmergingSidebar({ currentStoryId }: Props) {
  const stories = await fetchEmergingStories()
  
  // Filter out current story
  const otherStories = (stories ?? []).filter((s) => s.id !== currentStoryId)

  if (otherStories.length === 0) {
    return null
  }

  return (
    <aside
      aria-labelledby="other-emerging-heading"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden sticky top-24"
    >
      {/* Sidebar header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-[#e4e4e7] dark:bg-gray-700">
        <h2
          id="other-emerging-heading"
          className="text-sm font-bold text-gray-800 dark:text-gray-100"
        >
          Topik Berkembang Lainnya
        </h2>
      </div>

      {/* Stories list */}
      <ul className="divide-y divide-gray-50 dark:divide-gray-700/50">
        {otherStories.slice(0, 6).map((story) => (
          <li key={story.id}>
            <Link
              href={`/stories/${story.id}`}
              className="group block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
              aria-label={`Baca perkembangan tentang ${story.title}`}
            >
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                {story.title}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                  {story.actual_snapshot_count} hari
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  {story.snapshots.length > 0 ? `${story.snapshots[story.snapshots.length - 1].cluster_name.slice(0, 40)}...` : ''}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  )
}
