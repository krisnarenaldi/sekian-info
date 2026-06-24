import Link from 'next/link'
import type { EmergingStory } from '@/lib/supabase/queries/stories'

type Props = {
  stories: EmergingStory[] | null
}

export default function EmergingNewsCard({ stories }: Props) {
  const activeStories = stories ?? []
  const hasStories = activeStories.length > 0

  return (
    <section
      aria-labelledby="emerging-heading"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-[#e4e4e7] dark:bg-gray-800">
        <div>
          <h2
            id="emerging-heading"
            className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"
          >
            <span aria-hidden="true">📈</span> Emerging News
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Topik berita yang terus berkembang beberapa hari terakhir
          </p>
        </div>
      </div>

      <div className="p-5">
        {hasStories ? (
          <ul className="space-y-4" role="list">
            {activeStories.slice(0, 6).map((story) => (
              <li key={story.id} role="listitem">
                <Link
                  href={`/stories/${story.id}`}
                  className="flex items-start justify-between gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded p-1 -m-1"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-800 dark:text-gray-100 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug line-clamp-2">
                      {story.title}
                    </span>
                  </div>
                  
                  <span className="shrink-0 text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full font-semibold">
                    {story.actual_snapshot_count} hari
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Belum ada topik berita berkembang saat ini.
          </p>
        )}
      </div>
    </section>
  )
}
