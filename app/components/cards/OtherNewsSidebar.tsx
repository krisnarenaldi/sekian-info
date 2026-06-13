/**
 * OtherNewsSidebar — Right sidebar for /news/[slug] showing related news
 * from other feed types to keep users browsing longer.
 *
 * Logic:
 * - Determines current article's feed_type from its slug
 * - Shows a curated mix from the other 3 categories + a few from own category
 * - For example if current article is Indonesia → shows 3 Indonesia + 1 International + 1 Sport + 1 Investasi
 */

import Link from 'next/link'
import { DailyDigestRow } from '@/lib/supabase/queries/daily-digest'
import { fetchDailyDigest } from '@/lib/fetchers/fetchDailyDigest'
import { fetchInternationalNews } from '@/lib/fetchers/fetchInternationalNews'
import { fetchSportNews } from '@/lib/fetchers/fetchSportNews'
import { fetchMarketNews } from '@/lib/fetchers/fetchMarketNews'

type FeedType = 'indonesia' | 'international' | 'sport' | 'market'

const FEED_LABELS: Record<FeedType, { emoji: string; label: string }> = {
  indonesia: { emoji: '🇮🇩', label: 'Indonesia Info' },
  international: { emoji: '🌍', label: 'Internasional Info' },
  sport: { emoji: '⚽', label: 'Sport Info' },
  market: { emoji: '💼', label: 'Investasi Info' },
}

/** Map a feed_type to its display label used in the section header */
function getFeedLabel(feedType: FeedType) {
  return FEED_LABELS[feedType] ?? FEED_LABELS.indonesia
}

/**
 * Build the item list based on the current article's feed_type.
 *
 * Mix strategy:
 * - 3 items from the current feed_type (other articles the user might like)
 * - 1 item from each of the other 3 feed types
 *
 * Total: 6 items, fetched from all 4 categories.
 */
function buildMixedItems(
  currentType: FeedType,
  indonesiaItems: DailyDigestRow[],
  internationalItems: DailyDigestRow[],
  sportItems: DailyDigestRow[],
  marketItems: DailyDigestRow[]
): { items: DailyDigestRow[]; sections: { title: string; itemCount: number }[] } {
  const pool: Record<FeedType, DailyDigestRow[]> = {
    indonesia: indonesiaItems,
    international: internationalItems,
    sport: sportItems,
    market: marketItems,
  }

  const otherTypes: FeedType[] = (['indonesia', 'international', 'sport', 'market'] as FeedType[]).filter(
    (t) => t !== currentType
  )

  const sections: { title: string; itemCount: number }[] = []
  const result: DailyDigestRow[] = []

  // 3 items from current feed_type
  const currentItems = pool[currentType]?.slice(0, 3) ?? []
  if (currentItems.length > 0) {
    sections.push({ title: getFeedLabel(currentType).label, itemCount: currentItems.length })
    result.push(...currentItems)
  }

  // 1 item from each of the other 3 types
  for (const other of otherTypes) {
    const items = pool[other]?.slice(0, 1) ?? []
    if (items.length > 0) {
      sections.push({ title: getFeedLabel(other).label, itemCount: items.length })
      result.push(...items)
    }
  }

  return { items: result, sections }
}

/**
 * Deduplicate items by slug so we don't show the same article twice.
 */
function deduplicate(items: DailyDigestRow[]): DailyDigestRow[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.slug)) return false
    seen.add(item.slug)
    return true
  })
}

type Props = {
  currentSlug: string
}

export default async function OtherNewsSidebar({ currentSlug }: Props) {
  // Fetch all feed types in parallel
  const [indonesiaItems, internationalItems, sportItems, marketItems] = await Promise.all([
    fetchDailyDigest(),
    fetchInternationalNews(),
    fetchSportNews(),
    fetchMarketNews(),
  ])

  // Filter out the current article from all pools and deduplicate
  const filterCurrent = (items: DailyDigestRow[] | null) =>
    deduplicate((items ?? []).filter((item) => item.slug !== currentSlug))

  const filteredIndonesia = filterCurrent(indonesiaItems)
  const filteredInternational = filterCurrent(internationalItems)
  const filteredSport = filterCurrent(sportItems)
  const filteredMarket = filterCurrent(marketItems)

  // Determine the current article's feed_type by checking which pool has it
  const allPools: [FeedType, DailyDigestRow[]][] = [
    ['indonesia', indonesiaItems ?? []],
    ['international', internationalItems ?? []],
    ['sport', sportItems ?? []],
    ['market', marketItems ?? []],
  ]

  const currentType: FeedType =
    allPools.find(([, items]) => items.some((item) => item.slug === currentSlug))?.[0] ?? 'indonesia'

  const { items: mixedItems, sections } = buildMixedItems(
    currentType,
    filteredIndonesia,
    filteredInternational,
    filteredSport,
    filteredMarket
  )

  if (mixedItems.length === 0) {
    return null
  }

  // Track which section each item belongs to (for visual grouping)
  let sectionIndex = 0
  let itemsInCurrentSection = 0
  const currentSectionName = sections[0]?.title ?? ''

  return (
    <aside
      aria-labelledby="other-news-heading"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden sticky top-24"
    >
      {/* Sidebar header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-[#e4e4e7] dark:bg-gray-700">
        <h2
          id="other-news-heading"
          className="text-sm font-bold text-gray-800 dark:text-gray-100"
        >
          Berita Lainnya
        </h2>
      </div>

      {/* Mixed news list */}
      <ul className="divide-y divide-gray-50 dark:divide-gray-700/50">
        {mixedItems.map((item, idx) => {
          // Track section boundaries for section headers
          if (itemsInCurrentSection >= sections[sectionIndex]?.itemCount) {
            sectionIndex = Math.min(sectionIndex + 1, sections.length - 1)
            itemsInCurrentSection = 0
          }
          itemsInCurrentSection++

          const showSectionHeader = idx === 0 || itemsInCurrentSection === 1

          const categoryColor: Record<string, string> = {
            Nasional: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
            Ekonomi: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
            Politik: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
          }
          const badgeClass =
            categoryColor[item.category ?? ''] ??
            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'

          // Extract source names
          const sources: string[] = item.raw_json?.cluster_sources
            ? Array.isArray(item.raw_json.cluster_sources)
              ? (item.raw_json.cluster_sources as { name: string }[]).map((s) => s.name).filter(Boolean)
              : []
            : item.source
              ? [item.source]
              : []

          return (
            <li key={item.id}>
              {showSectionHeader && sectionIndex < sections.length && (
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {sections[sectionIndex]?.title ?? currentSectionName}
                  </span>
                </div>
              )}
              <Link
                href={`/news/${item.slug}`}
                className="group block px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
                aria-label={`Baca lebih lanjut tentang ${item.title}`}
              >
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                  {item.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">
                  {item.summary}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {item.category && (
                    <span
                      className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeClass}`}
                    >
                      {item.category}
                    </span>
                  )}
                  {sources.length > 0 && (
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[120px]">
                      {sources.join(' · ')}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20">
        <Link
          href="/news"
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded transition-colors"
        >
          Lihat semua berita →
        </Link>
      </div>
    </aside>
  )
}