/**
 * RSS Fetcher — fetches RSS feeds from various news sources.
 *
 * Each `fetchRSS` call is constrained by:
 *   - Max 20 items per source (ITEM_LIMIT)
 *   - 10 second timeout per source (DEFAULT_TIMEOUT_MS)
 *   - Per-source errors are logged and do not halt the pipeline
 *
 * Requirements: 8.2, 10.2
 */

import Parser from 'rss-parser'
import { createLogger } from '../utils/logger'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum items fetched per RSS source. */
export const ITEM_LIMIT = 20

/** Default timeout per RSS source (milliseconds). */
export const DEFAULT_TIMEOUT_MS = 10_000

const log = createLogger('rss-fetcher')

// ---------------------------------------------------------------------------
// Source definitions
// ---------------------------------------------------------------------------

export interface RSSSource {
  name: string
  url: string
}

/**
 * Indonesian national news sources.
 * Requirements: 8.2
 */
export const NEWS_SOURCES: RSSSource[] = [
  { name: 'Detik', url: 'https://news.detik.com/berita/rss' },
  // { name: 'Kompas', url: 'https://indeks.kompas.com/?site=news&format=rss' },
  { name: 'CNN Indonesia', url: 'https://www.cnnindonesia.com/nasional/rss' },
  { name: 'Tempo', url: 'https://rss.tempo.co/nasional' },
  { name: 'Antara', url: 'https://www.antaranews.com/rss/top-news' },
  { name: 'Kumparan', url: 'https://lapi.kumparan.com/v2.0/rss' },
  { name: 'Media Indonesia', url: 'https://mediaindonesia.com/feed/all' },
  { name: 'Viva', url: 'https://www.viva.co.id/get/all' },
  { name: 'Liputan 6', url: 'https://feed.liputan6.com/rss/news' },
  { name: 'Tirto', url: 'https://tirto.id/sitemap/r/google-discover' },
  { name: 'Republika', url: 'https://www.republika.co.id/rss' },
  { name: 'CNBC', url: 'https://www.cnbcindonesia.com/rss' },
  { name: 'Sindonews', url: 'https://www.sindonews.com/feed' },
  { name: 'Inilah.com', url: 'https://www.inilah.com/rss.xml' },
]

/**
 * Global AI news sources.
 * Requirements: 10.2
 */
export const AI_NEWS_SOURCES: RSSSource[] = [
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml' },
  { name: 'Anthropic', url: 'https://www.anthropic.com/news/rss.xml' },
  { name: 'Google AI', url: 'https://blog.google/technology/ai/rss/' },
  { name: 'Meta AI', url: 'https://ai.meta.com/blog/rss/' },
  { name: 'HuggingFace', url: 'https://huggingface.co/blog/feed.xml' },
]

/**
 * Indonesian sports news sources.
 */
export const SPORT_NEWS_SOURCES: RSSSource[] = [
  { name: 'Detik Sport', url: 'https://sport.detik.com/rss' },
  { name: 'Antara Sport', url: 'https://www.antaranews.com/rss/olahraga' },
  { name: 'Okezone Sport', url: 'https://sindikasi.okezone.com/index.php/rss/14/RSS2.0' },
  { name: 'CNN Sport', url: 'https://www.cnnindonesia.com/olahraga/rss'},
  { name: 'Liputan6 Bola', url: 'https://feed.liputan6.com/rss/bola'},  
]

/**
 * International news sources.
 */
export const INTERNATIONAL_NEWS_SOURCES: RSSSource[] = [
  { name: 'BBC', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { name: 'CNN World', url: 'http://rss.cnn.com/rss/edition_world.rss' },
  { name: 'NYTimes World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { name: 'DW', url: 'https://rss.dw.com/rdf/rss-en-all' },
]

/**
 * Market/Investment news sources.
 */
export const MARKET_NEWS_SOURCES: RSSSource[] = [
  { name: 'Kontan', url: 'https://www.kontan.co.id/rss' },
  { name: 'Bisnis.com', url: 'https://feeds.bisnis.com/rss' },
  { name: 'CNBC Market', url: 'https://www.cnbcindonesia.com/market/rss' },
  { name: 'Okezone Economy', url: 'https://economy.okezone.com/rss' },
  { name: 'Republika Ekonomi', url: 'https://www.republika.co.id/rss/ekonomi' },
  { name: 'Detik Finance', url: 'https://finance.detik.com/rss' },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Normalised item returned by `fetchRSS` and `fetchAllSources`. */
export interface RSSItem {
  /** Article headline. */
  title: string | undefined
  /** Short text excerpt or content snippet. */
  description: string | undefined
  /** Full HTML/text content, when provided by the feed. */
  content: string | undefined
  /** Canonical article URL. */
  link: string | undefined
  /** Publication date string as provided by the feed. */
  pubDate: string | undefined
  /** ISO 8601 publication date, when provided by the feed. */
  isoDate: string | undefined
  /** Author or creator name, when provided. */
  creator: string | undefined
  /** Display name of the source (e.g. "Detik", "OpenAI"). */
  source: string
  /** Image URL extracted from enclosure, media:content, or content HTML. */
  image: string | undefined
}

/**
 * @deprecated Use `RSSItem` instead.
 * Kept for backward compatibility with existing consumers.
 */
export type RawRSSItem = RSSItem & {
  /** @deprecated Use `description` instead. */
  contentSnippet?: string
  /** @deprecated Use `source` instead. */
  sourceName?: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function timeoutPromise<T>(ms: number): Promise<T> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
  )
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Fetch RSS items from a single source URL.
 *
 * - Enforces a per-request timeout via `Promise.race`.
 * - Limits results to `limit` items (hard-capped at `ITEM_LIMIT`).
 * - On any error (network, timeout, parse), logs the error and returns an
 *   empty array rather than throwing — callers never need to wrap in try/catch.
 *
 * Requirements: 8.2, 10.2
 *
 * @param sourceUrl  - RSS feed URL to fetch
 * @param limit      - Max items to return (default: ITEM_LIMIT = 20)
 * @param timeout    - Timeout in milliseconds (default: DEFAULT_TIMEOUT_MS = 10000)
 * @param sourceName - Optional display name for the source; defaults to `sourceUrl`
 * @returns Array of RSS items (up to `limit`), or empty array on error
 */
export async function fetchRSS(
  sourceUrl: string,
  limit: number = ITEM_LIMIT,
  timeout: number = DEFAULT_TIMEOUT_MS,
  sourceName?: string,
): Promise<RSSItem[]> {
  const effectiveLimit = Math.min(limit, ITEM_LIMIT)
  const displayName = sourceName ?? sourceUrl

  try {
    const parser = new Parser()

    const feed = await Promise.race([
      parser.parseURL(sourceUrl),
      timeoutPromise<never>(timeout),
    ])

    const items = (feed.items ?? []).slice(0, effectiveLimit).map(
      (item): RSSItem => {
        // Extract image: enclosure > media:content/media:thumbnail > first <img> in content
        let image: string | undefined

        // 1) Try enclosure (RSS 2.0 <enclosure url="..." />) — typed by rss-parser
        image = item.enclosure?.url

        // 2) Try media:content (cast to any since not in default rss-parser types)
        if (!image) {
          const anyItem = item as any
          if (anyItem['media:content']?.$?.url) {
            image = anyItem['media:content'].$.url
          }
        }

        // 3) Try <media:thumbnail>
        if (!image) {
          const anyItem = item as any
          if (anyItem['media:thumbnail']?.$?.url) {
            image = anyItem['media:thumbnail'].$.url
          }
        }

        // 4) Try parsing <img> from content HTML
        if (!image && item.content) {
          const imgMatch = item.content.match(/<img[^>]+src=["']([^"']+)["']/)
          if (imgMatch) image = imgMatch[1]
        }

        return {
          title: item.title,
          link: item.link,
          description: item.contentSnippet,
          content: item.content,
          pubDate: item.pubDate,
          isoDate: item.isoDate,
          creator: item.creator,
          source: displayName,
          image,
        }
      },
    )

    log.info(`Fetched ${items.length} items from "${displayName}"`)
    return items
  } catch (err) {
    log.error(`Failed to fetch "${displayName}" (${sourceUrl})`, err)
    return []
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Fetch RSS from multiple sources sequentially.
 * Per-source errors are caught and logged without halting other sources.
 *
 * Requirements: 8.2, 10.2
 *
 * @param sources - Array of { name, url } source definitions
 * @param limit   - Max items per source (default: ITEM_LIMIT = 20)
 * @param timeout - Timeout per source in milliseconds (default: DEFAULT_TIMEOUT_MS = 10000)
 * @returns Combined items from all successfully fetched sources
 */
export async function fetchAllSources(
  sources: RSSSource[],
  limit: number = ITEM_LIMIT,
  timeout: number = DEFAULT_TIMEOUT_MS,
): Promise<RSSItem[]> {
  const allItems: RSSItem[] = []

  for (const source of sources) {
    // fetchRSS already handles errors internally and returns []
    const items = await fetchRSS(source.url, limit, timeout, source.name)
    allItems.push(...items)
  }

  return allItems
}
