import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { updateTrendingDataForDate } from '@/lib/pipeline/trending-fetcher'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger('cron-trending')

function getTodayWIB(): string {
  const now = new Date()
  const wibOffset = 7 * 60 * 60 * 1000
  const wibDate = new Date(now.getTime() + wibOffset)
  return wibDate.toISOString().slice(0, 10)
}

export async function POST(req: Request): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    log.warn('Unauthorized request to /api/cron/trending — invalid or missing CRON_SECRET')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = getTodayWIB()
  log.info(`Cron pipeline started for date ${date}`)

  try {
    const trendingData = await updateTrendingDataForDate(date)
    log.info(`Trending data updated for ${date}`)

    // Revalidate Next.js cache so homepage picks up the new data immediately
    // revalidateTag invalidates the unstable_cache tag used in fetchTrending
    revalidateTag('trending', 'max')

    return NextResponse.json({
      success: true,
      date,
      data: trendingData,
    })
  } catch (err) {
    log.error('Failed to update trending data', err)
    return NextResponse.json(
      { error: 'Failed to update trending data', details: String(err) },
      { status: 500 },
    )
  }
}
