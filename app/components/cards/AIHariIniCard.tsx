import type { AINewsDigestRow, AINewsItem } from '@/lib/supabase/queries/ai-news'

type Props = {
  aiNews: AINewsDigestRow | null
}

export default function AIHariIniCard({ aiNews }: Props) {
  const hasItems = aiNews?.items && aiNews.items.length > 0

  return (
    <section
      aria-labelledby="ai-heading"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
        <h2 id="ai-heading" className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <span aria-hidden="true">🤖</span> AI Hari Ini
        </h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">Global</span>
      </div>

      <div className="p-5">
        {!hasItems ? (
          <p className="text-sm text-gray-400 dark:text-gray-500" role="status">
            Belum ada berita AI hari ini
          </p>
        ) : (
          <ol className="space-y-3 list-none">
            {aiNews!.items.map((item: AINewsItem, idx: number) => (
              <li key={idx}>
                <article
                  aria-label={`Berita AI: ${item.title}`}
                  className="p-3.5 bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-100 dark:border-gray-600/30"
                >
                  <h3 className="text-xs font-semibold text-gray-800 dark:text-gray-100 leading-snug mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 leading-relaxed">
                    {item.summary}
                  </p>
                  <div className="flex gap-1.5 mb-2">
                    <span aria-hidden="true" className="text-blue-400 shrink-0 text-xs">💡</span>
                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                      <span className="sr-only">Dampak: </span>{item.impact}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 gap-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{item.source}</span>
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Baca "${item.title}" di ${item.source}`}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                      >
                        Baca →
                      </a>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
