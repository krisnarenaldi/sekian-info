import Link from 'next/link'
import ErrorCard from '../shared/ErrorCard'
import type { DailyDigestRow } from '@/lib/supabase/queries/daily-digest'

type Props = {
  digestItems: DailyDigestRow[] | null
}

/** Extract source names from cluster_sources (handles string[] or object[] with "name" property). */
function extractSources(raw: Record<string, unknown> | null | undefined): string[] {
  if (!raw) return []
  const cs = raw.cluster_sources
  if (!Array.isArray(cs) || cs.length === 0) return []
  return cs.map((s) => {
    if (typeof s === 'string') return s
    if (s && typeof s === 'object' && 'name' in s) return String((s as Record<string, unknown>).name)
    return String(s)
  })
}

function renderListItem(item: DailyDigestRow, badgeClass: string) {
  const topicLabel = item.cluster_name?.trim() || item.title

  return (
    <li key={item.id}>
      <Link href={`/news/${item.slug}`} className="group block px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-inset" aria-label={`Baca lebih lanjut tentang ${topicLabel}`}>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-snug group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{topicLabel}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">{item.summary}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {item.category && item.category !== 'Nasional' && (
            <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeClass}`}>{item.category}</span>
          )}
          {(() => {
            const sources: string[] = extractSources(item.raw_json)
            if (sources.length === 0 && item.source) {
              sources.push(item.source)
            }

            return sources.length > 0 ? (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">{sources.join(' · ')}</span>
            ) : null
          })()}
        </div>
      </Link>
    </li>
  )
}

function renderHeroImage(item: DailyDigestRow) {
  const heroImage = item?.raw_json?.image as string | undefined
  if (!heroImage) return null

  const topicLabel = item.cluster_name?.trim() || item.title

  const sources: string[] = extractSources(item.raw_json)
  if (sources.length === 0 && item.source) {
    sources.push(item.source)
  }

  return (
    <Link
      href={`/news/${item.slug}`}
      className="relative block w-full h-56 overflow-hidden group"
      aria-label={`Baca lebih lanjut tentang ${topicLabel}`}
    >
      <img
        src={heroImage}
        alt=""
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      {/* Text content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        {item.category && (
          <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mb-2 text-white bg-green-500/80">
            {item.category}
          </span>
        )}
        <h3 className="text-white text-sm font-bold leading-snug drop-shadow-sm">
          {topicLabel}
        </h3>
        <p className="text-white/80 text-xs mt-1 leading-relaxed line-clamp-2 drop-shadow-sm">
          {item.summary}
        </p>
        {sources.length > 0 && (
          <p className="text-white/60 text-[11px] mt-1.5">
            {sources.join(' · ')}
          </p>
        )}
      </div>
    </Link>
  )
}

export default function PasarInvestasiCard({ digestItems }: Props) {
  if (!digestItems || digestItems.length === 0) {
    return <ErrorCard />
  }

  const displayItems = digestItems.slice(0, 5)
  const badgeClass = 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'

  return (
    <section
      aria-labelledby="market-heading"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-[#e4e4e7]">
        <h2 id="market-heading" className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <span aria-hidden="true">💼</span> Investasi Info
        </h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">Hari Ini</span>
      </div>

      {/* Items 0 and 1 */}
      {displayItems.slice(0, 2).length > 0 && (
        <ul className="divide-y divide-gray-50 dark:divide-gray-700/50" aria-label="Daftar topik berita pasar/investasi hari ini">
          {displayItems.slice(0, 2).map((item) => renderListItem(item, badgeClass))}
        </ul>
      )}

      {/* Hero image for third item (index 2) — appears between items 1 and 3 */}
      {renderHeroImage(displayItems[2])}

      {/* Items 3 and 4 */}
      {displayItems.slice(3).length > 0 && (
        <ul className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {displayItems.slice(3).map((item) => renderListItem(item, badgeClass))}
        </ul>
      )}

      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20">
        <Link href="/news?feed_type=market" className="text-xs font-medium text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded transition-colors" aria-label="Lihat daftar lengkap berita pasar/investasi hari ini">Lihat semua berita →</Link>
      </div>
    </section>
  )
}