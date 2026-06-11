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
      <Link
        href={`/news/${item.slug}`}
        className="group block px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset"
        aria-label={`Baca lebih lanjut tentang ${topicLabel}`}
      >
        {/* Nama topik cluster */}
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-snug group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
          {topicLabel}
        </p>

        {/* Ringkasan singkat dari LLM */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">
          {item.summary}
        </p>

        {/* Category badge + semua sumber dalam cluster */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {item.category && item.category !== 'Nasional' && (
            <span
              className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeClass}`}
            >
              {item.category}
            </span>
          )}
          {(() => {
            const sources: string[] = extractSources(item.raw_json)
            if (sources.length === 0 && item.source) {
              sources.push(item.source)
            }

            return sources.length > 0 ? (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {sources.join(' · ')}
              </span>
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
  const categoryColor: Record<string, string> = {
    'Sepak Bola': 'bg-emerald-500/80',
    'Bulutangkis': 'bg-orange-500/80',
    'Tenis': 'bg-purple-500/80',
    'Basket': 'bg-blue-500/80',
    'Olahraga': 'bg-pink-500/80',
  }
  const badgeClass = categoryColor[item.category ?? ''] ?? 'bg-gray-500/80'

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
          <span
            className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mb-2 text-white ${badgeClass}`}
          >
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

export default function SportHariIniCard({ digestItems }: Props) {
  if (!digestItems || digestItems.length === 0) {
    return <ErrorCard />
  }

  const displayItems = digestItems.slice(0, 5)
  const categoryColor: Record<string, string> = {
    'Sepak Bola': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    'Bulutangkis': 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    'Tenis': 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    'Basket': 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'Olahraga': 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  }

  const getBadgeClass = (cat: string | null | undefined) =>
    categoryColor[cat ?? ''] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'

  return (
    <section
      aria-labelledby="sport-heading"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-[#e4e4e7]">
        <h2
          id="sport-heading"
          className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"
        >
          <span aria-hidden="true">⚽</span> Sport Info
        </h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">Hari Ini</span>
      </div>

      {/* First 3 items as list */}
      <ul
        className="divide-y divide-gray-50 dark:divide-gray-700/50"
        aria-label="Daftar topik berita olahraga hari ini"
      >
        {displayItems.slice(0, 3).map((item) =>
          renderListItem(item, getBadgeClass(item.category))
        )}
      </ul>

      {/* Hero image for fourth item (index 3) — appears between items 3 and 4 */}
      {renderHeroImage(displayItems[3])}

      {/* Last item (index 4) — always in list after hero */}
      {displayItems[4] && (
        <ul className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {renderListItem(displayItems[4], getBadgeClass(displayItems[4].category))}
        </ul>
      )}

      {/* Footer link */}
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20">
        <Link
          href="/news?feed_type=sport"
          className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded transition-colors"
          aria-label="Lihat daftar lengkap berita olahraga hari ini"
        >
          Lihat semua berita →
        </Link>
      </div>
    </section>
  )
}