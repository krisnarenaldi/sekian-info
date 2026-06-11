import { NextRequest, NextResponse } from 'next/server'
import { fetchRSS } from '@/lib/pipeline/rss-fetcher'

/**
 * GET /api/rss-proxy?url=...
 *
 * Proxies an RSS feed URL and returns the parsed items as JSON.
 * Used by client-side components that need to fetch RSS feeds
 * without CORS restrictions.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing "url" query parameter' }, { status: 400 })
  }

  // Basic URL validation to prevent abuse
  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const items = await fetchRSS(url, 5, 10_000)

  return NextResponse.json({ items })
}