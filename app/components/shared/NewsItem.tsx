import Link from 'next/link'

type NewsItemProps = {
  title: string
  summary: string
  slug: string
  source: string
  category?: string | null
  sources?: string[]
}

export default function NewsItem({ title, summary, slug, source, category, sources }: NewsItemProps) {
  const allSources = sources ?? (source ? [source] : [])

  return (
    <Link
      href={`/news/${slug}`}
      className="group block rounded-lg px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      aria-label={`Baca lebih lanjut tentang ${title}`}
    >
      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {title}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed line-clamp-2">
        {summary}
      </p>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {category && (
          <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {category}
          </span>
        )}
        {allSources.length > 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500">{allSources.join(' · ')}</p>
        )}
      </div>
    </Link>
  )
}
