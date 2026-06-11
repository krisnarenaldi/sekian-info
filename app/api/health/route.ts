/**
 * GET /api/health — Health check endpoint
 *
 * Requirements: 14.4
 */

import { NextResponse } from 'next/server'
import { getLatestDailyDigest } from '@/lib/supabase/queries/daily-digest'
import { getLatestTrendingData } from '@/lib/supabase/queries/trending'
import { getLatestMarketData } from '@/lib/supabase/queries/market-data'
import { getLatestAINewsDigest } from '@/lib/supabase/queries/ai-news'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger('api-health')

export async function GET(): Promise<NextResponse> {
    try {
        const [digest, trending, market, aiNews] = await Promise.allSettled([
            getLatestDailyDigest(),
            getLatestTrendingData(),
            getLatestMarketData(),
            getLatestAINewsDigest(),
        ])

        return NextResponse.json({
            status: 'ok',
            database: 'connected',
            last_updated: {
                daily_digest: digest.status === 'fulfilled' && digest.value.length > 0
                    ? digest.value[0].created_at
                    : null,
                trending: trending.status === 'fulfilled' && trending.value
                    ? trending.value.created_at
                    : null,
                market_data: market.status === 'fulfilled' && market.value
                    ? market.value.created_at
                    : null,
                ai_news_digest: aiNews.status === 'fulfilled' && aiNews.value
                    ? aiNews.value.created_at
                    : null,
            },
        })
    } catch (err) {
        log.error('Health check failed', err)
        return NextResponse.json(
            { status: 'error', error: 'Database connection failed' },
            { status: 500 }
        )
    }
}
