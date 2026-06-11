import Parser from 'rss-parser'
import { upsertTrendingData, TrendingTopic } from '@/lib/supabase/queries/trending'

const parser = new Parser({
  customFields: {
    item: [['ht:approx_traffic', 'approx_traffic']],
  },
})

function parseTraffic(trafficStr?: string): number | null {
  if (!trafficStr) return null

  const clean = trafficStr.replace(/[+,]/g, '').trim().toUpperCase()

  if (clean.includes('M')) {
    return Math.floor(parseFloat(clean.replace('M', '')) * 1_000_000)
  }

  if (clean.includes('K')) {
    return Math.floor(parseFloat(clean.replace('K', '')) * 1_000)
  }

  const parsed = parseInt(clean, 10)
  return Number.isNaN(parsed) ? null : parsed
}

export async function fetchTrendingTopicsFromRSS(
  geo = 'ID',
): Promise<TrendingTopic[]> {
  const feed = await parser.parseURL(`https://trends.google.com/trending/rss?geo=${geo}`)

  return (feed.items ?? [])
    .map((item) => {
      const approxTraffic = (item as Parser.Item & { approx_traffic?: string }).approx_traffic
      return {
        keyword: item.title ?? '',
        search_volume: parseTraffic(approxTraffic),
      }
    })
    .filter((topic) => topic.keyword.length > 0)
}

export async function updateTrendingDataForDate(
  date: string,
  geo = 'ID',
) {
  const topics = await fetchTrendingTopicsFromRSS(geo)
  if (topics.length === 0) {
    throw new Error('Google Trends RSS feed returned no trending topics')
  }

  return await upsertTrendingData(date, topics)
}
