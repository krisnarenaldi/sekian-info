/**
 * GET /api/trending — Trending topics endpoint
 *
 * Requirements: 5.1, 5.2, 5.4
 */

import { NextResponse } from 'next/server'
import { getTrendingData, upsertTrendingData, getLatestTrendingData } from '@/lib/supabase/queries/trending'
import { createLogger } from '@/lib/utils/logger'
import { fetchTrendingTopicsFromRSS } from '@/lib/pipeline/trending-fetcher'

// Helper to get today in YYYY-MM-DD
function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const log = createLogger('api-trending')

export async function GET(): Promise<NextResponse> {
  const today = getTodayISO()
  log.info('Request for trending topics')

  try {
    // Check cache for today's data first
    const trendingData = await getTrendingData(today)
    if (trendingData) {
      log.info('Using cached trending data for today')
      return NextResponse.json(trendingData)
    }

    log.info('No cached data for today — trying to fetch live')
    const topics = await fetchTrendingTopicsFromRSS('ID')

    if (topics.length > 0) {
      log.info(`Successfully fetched ${topics.length} trends, saving to DB`)
      const saved = await upsertTrendingData(today, topics)
      return NextResponse.json(saved)
    }

    log.warn('Fetched feed has no items')
    throw new Error('Google Trends RSS feed is empty')
  } catch (err) {
    log.error('Error in /api/trending', err)
    // Fallback to latest data on error
    try {
      const latestData = await getLatestTrendingData()
      if (latestData) {
        log.info('Falling back to latest available trending data')
        return NextResponse.json(latestData)
      }
    } catch (fallbackErr) {
      log.error('Fallback to latest data also failed', fallbackErr)
    }
    return NextResponse.json({ error: 'Failed to fetch trending data' }, { status: 500 })
  }
}
