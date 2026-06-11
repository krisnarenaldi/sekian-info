import type { TrendingData } from '@/lib/supabase/queries/trending'

type Props = {
  trendingData: TrendingData | null
}

function formatDateID(dateStr: string): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]
  const [year, month, day] = dateStr.split('-')
  return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`
}

function formatVolume(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}rb`
  return String(value)
}

export default function TrendingCard({ trendingData }: Props) {
  const topics = trendingData?.topics ?? []
  const hasTopics = topics.length > 0
  const lastUpdated = trendingData?.date

  // Sort topics by search_volume descending (highest first), then take top 10
  const sortedTopics = [...topics]
    .sort((a, b) => (b.search_volume ?? 0) - (a.search_volume ?? 0))
    .slice(0, 7)

  // Find max search volume for bar scaling
  const maxVolume = Math.max(
    ...sortedTopics.map((t) => t.search_volume ?? 0),
    1,
  )

  // Check if any topic has search_volume data
  const hasVolumeData = sortedTopics.some((t) => t.search_volume != null)

  return (
    <section
      aria-labelledby="trending-heading"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-[#e4e4e7]">
        <div>
          <h2
            id="trending-heading"
            className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"
          >
            <span aria-hidden="true">🔥</span> Trending Info
          </h2>
          {lastUpdated ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Data terakhir: {formatDateID(lastUpdated)}
            </p>
          ) : null}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">24 jam</span>
      </div>

      <div className="p-5">
        {hasTopics ? (
          hasVolumeData ? (
            /* ── Horizontal Bar Chart (sorted by volume) ── */
            <div
              className="space-y-3"
              role="list"
              aria-label="Topik trending berdasarkan volume pencarian"
            >
              {sortedTopics.map((topic, idx) => {
                const volume = topic.search_volume ?? 0
                const barWidth = maxVolume > 0 ? (volume / maxVolume) * 100 : 0
                const rank = idx + 1

                // Color intensity based on rank (1 = most intense)
                const barColor =
                  rank <= 3
                    ? 'bg-orange-500 dark:bg-orange-400'
                    : rank <= 6
                      ? 'bg-orange-400 dark:bg-orange-500/70'
                      : 'bg-orange-300 dark:bg-orange-600/50'

                return (
                  <div
                    key={`${topic.keyword}-${idx}`}
                    role="listitem"
                    className="flex items-center gap-2 group"
                  >
                    {/* Rank number */}
                    <span className="text-xs font-bold text-gray-300 dark:text-gray-600 w-4 shrink-0 text-right">
                      {rank}
                    </span>

                    {/* Keyword + Bar column */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700 dark:text-gray-200 font-medium truncate">
                          {topic.keyword}
                        </span>
                        {volume > 0 && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-2 tabular-nums">
                            {formatVolume(volume)}
                          </span>
                        )}
                      </div>
                      <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* ── Fallback: ranked list (no volume data) ── */
            <ol aria-label="Daftar topik trending Indonesia">
              {sortedTopics.map((topic, idx) => (
                <li
                  key={`${topic.keyword}-${idx}`}
                  className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                >
                  <span className="text-xs font-bold text-gray-300 dark:text-gray-600 w-4 shrink-0 text-right">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-200 font-medium flex-1 leading-snug">
                    {topic.keyword}
                  </span>
                  {topic.search_volume != null && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                      {formatVolume(topic.search_volume)}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Data trending tidak tersedia saat ini. Tunggu pembaruan cron atau
            periksa kembali nanti.
          </p>
        )}
      </div>
    </section>
  )
}