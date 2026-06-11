/**
 * GET /api/news/[slug] — On-demand article summary
 *
 * Flow:
 *  1. Validate slug with /^[a-z0-9-]{1,200}$/ → 400 if invalid
 *  2. Get source_url + title + cluster_sources from daily_digest → 404 if not found
 *  3. Check article_cache → return cached data if found (merged with cluster_sources)
 *  4. Scrape article (max 500 KB)
 *  5. If scrape fails → return 200 with error: "Ringkasan tidak tersedia" (no cache write)
 *  6. LLM summarize → { summary, key_points }
 *  7. Save to article_cache
 *  8. Return 200 with full data (merged with cluster_sources)
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 11.4, 13.3
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateSlug } from '@/lib/utils/slug'
import { getArticleBySlug, insertArticleCache } from '@/lib/supabase/queries/article-cache'
import { getDailyDigestBySlug } from '@/lib/supabase/queries/daily-digest'
import { scrapeArticle } from '@/lib/pipeline/article-scraper'
import { summarizeArticle } from '@/lib/pipeline/llm-summarizer'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger('api-news-slug')

/** Shape of a single cluster source entry stored in daily_digest.raw_json */
interface ClusterSourceEntry {
  name: string
  url: string
}

/**
 * Extract cluster_sources from a daily_digest row's raw_json.
 * Handles both the old string[] format and the new { name, url }[] format.
 */
function extractClusterSources(rawJson: Record<string, unknown> | null | undefined): ClusterSourceEntry[] {
  if (!rawJson?.cluster_sources) return []

  const cs = rawJson.cluster_sources
  if (!Array.isArray(cs)) return []

  // New format: array of { name, url }
  if (cs.length > 0 && typeof cs[0] === 'object' && cs[0] !== null && 'url' in cs[0]) {
    return cs as ClusterSourceEntry[]
  }

  // Old format: array of strings (name only) — convert to { name, url: '' }
  if (typeof cs[0] === 'string') {
    return (cs as string[]).map((name) => ({ name, url: '' }))
  }

  return []
}

/**
 * Try to enrich with cluster_sources from daily_digest.
 * Non-fatal — returns empty array on any error.
 */
async function fetchClusterSources(slug: string): Promise<ClusterSourceEntry[]> {
  try {
    const digestItem = await getDailyDigestBySlug(slug)
    if (digestItem) {
      return extractClusterSources(digestItem.raw_json)
    }
  } catch {
    // Not fatal — just return empty
  }
  return []
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params

  // Step 1: Validate slug — must match /^[a-z0-9-]{1,200}$/
  if (!validateSlug(slug)) {
    log.warn(`Invalid slug rejected: "${slug}"`)
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  log.info(`GET /api/news/${slug}`)

  try {
    // Step 2: Check article_cache first — return immediately on cache hit
    const cached = await getArticleBySlug(slug)
    if (cached) {
      log.info(`Cache hit for slug: "${slug}"`)
      const cluster_sources = await fetchClusterSources(slug)
      return NextResponse.json({
        ...cached,
        cluster_sources,
      })
    }

    // Step 3: Article not cached — get source details from daily_digest
    const digestItem = await getDailyDigestBySlug(slug)
    if (!digestItem) {
      log.warn(`No daily_digest entry found for slug: "${slug}"`)
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const { title, source_url, source: source_name } = digestItem
    const cluster_sources = extractClusterSources(digestItem.raw_json)

    log.info(`Cache miss for slug: "${slug}" — starting on-demand generation`)

    // Step 4: Scrape article content (max 500 KB)
    let content: string
    try {
      log.info(`Scraping article from: ${source_url}`)
      content = await scrapeArticle(source_url, 500 * 1024)
    } catch (scrapeErr) {
      // Step 5: Scrape failed — return 200 with error indicator, no cache write
      log.error(`Scrape failed for slug "${slug}"`, scrapeErr)
      return NextResponse.json({
        title,
        summary: null,
        key_points: null,
        source_url,
        source_name,
        cluster_sources,
        error: 'Ringkasan tidak tersedia',
      })
    }

    // Step 6: Generate summary via LLM
    let summary: string
    let key_points: string[]
    try {
      log.info(`Generating summary for: "${title}"`)
      const result = await summarizeArticle(content, title)
      summary = result.summary
      key_points = result.key_points
    } catch (llmErr) {
      // LLM failure also falls back to the "tidak tersedia" response, no cache write
      log.error(`LLM summarization failed for slug "${slug}"`, llmErr)
      return NextResponse.json({
        title,
        summary: null,
        key_points: null,
        source_url,
        source_name,
        cluster_sources,
        error: 'Ringkasan tidak tersedia',
      })
    }

    // Step 7: Save to article_cache (only on success — prevents repeated LLM calls)
    const savedCache = await insertArticleCache({
      slug,
      title,
      summary,
      key_points,
      source_url,
      source_name,
    })

    log.info(`Article cache saved for slug: "${slug}"`)

    // Step 8: Return full data
    return NextResponse.json({
      ...savedCache,
      cluster_sources,
    })
  } catch (err) {
    log.error(`Unexpected error in GET /api/news/${slug}`, err)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
