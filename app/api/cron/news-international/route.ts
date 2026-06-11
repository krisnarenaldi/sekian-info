/**
 * POST /api/cron/news-international — Pipeline "Berita International"
 *
 * Diproteksi oleh CRON_SECRET (Bearer token di header Authorization).
 * Hanya boleh dipanggil oleh Vercel Cron, bukan oleh request pengguna.
 *
 * Pipeline:
 *   RSS Fetch → Normalize → Embed → Cluster → Score → Top 20
 *   → LLM Summarize → Save ke daily_digest dengan feed_type='international'
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { fetchAllSources, INTERNATIONAL_NEWS_SOURCES } from '@/lib/pipeline/rss-fetcher'
import { normalizeAll } from '@/lib/pipeline/normalizer'
import { batchEmbed } from '@/lib/pipeline/embedding-engine'
import { cluster } from '@/lib/pipeline/clusterer'
import { scoreAll } from '@/lib/pipeline/scorer'
import { summarizeNews } from '@/lib/pipeline/llm-summarizer'
import { upsertDailyDigest } from '@/lib/supabase/queries/daily-digest'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger('cron-news-international')

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 200)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization')
  const expectedToken = process.env.CRON_SECRET

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    log.warn('Unauthorized request to /api/cron/news-international')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = todayISO()
  log.info(`Pipeline "Berita International" dimulai untuk tanggal ${date}`)

  try {
    log.info('Step 1/6: Fetching RSS dari semua sumber berita internasional')
    const rawItems = await fetchAllSources(INTERNATIONAL_NEWS_SOURCES)
    log.info(`Step 1/6: Berhasil mengambil ${rawItems.length} item dari RSS`)

    if (rawItems.length === 0) {
      log.warn('Tidak ada artikel yang berhasil di-fetch dari semua sumber RSS internasional')
      return NextResponse.json(
        { error: 'Semua sumber RSS internasional tidak dapat diakses. Data hari sebelumnya dipertahankan.' },
        { status: 503 },
      )
    }

    log.info('Step 2/6: Normalisasi artikel')
    const normalized = normalizeAll(rawItems)
    log.info(`Step 2/6: ${normalized.length} artikel valid setelah normalisasi`)

    if (normalized.length === 0) {
      log.warn('Tidak ada artikel valid setelah normalisasi')
      return NextResponse.json(
        { error: 'Tidak ada artikel valid yang dapat diproses.' },
        { status: 422 },
      )
    }

    log.info(`Step 3/6: Membuat embedding untuk ${normalized.length} artikel`)
    const texts = normalized.map((item) => `${item.title} ${item.description}`)
    const embeddings = await batchEmbed(texts)
    log.info(`Step 3/6: Embedding selesai (${embeddings.length} vektor)`)

    log.info('Step 4/6: Clustering artikel berdasarkan kesamaan topik')
    const clusters = cluster(normalized, embeddings)
    log.info(`Step 4/6: ${clusters.length} cluster terbentuk`)

    log.info('Step 5/6: Scoring cluster dan memilih top 5')
    const top5 = scoreAll(clusters, 5)
    log.info(`Step 5/6: Top ${top5.length} cluster dipilih untuk diteruskan ke LLM`)

    log.info('Step 6/6: Memanggil LLM untuk memberi nama cluster dan menghasilkan ringkasan berita')
    let newsItems
    try {
      newsItems = await summarizeNews(top5)
    } catch (llmError) {
      log.error('LLM_Summarizer gagal pada pipeline "Berita International".', llmError)
      return NextResponse.json(
        { error: 'LLM summarization gagal. Data hari sebelumnya dipertahankan.' , detail: llmError instanceof Error ? llmError.message : String(llmError)},
        { status: 500 },
      )
    }

    log.info(`Step 6/6: LLM menghasilkan ${newsItems.length} item berita`)

    const digestItems = newsItems.map((item, i) => ({
      title: item.title,
      summary: item.summary,
      slug: slugify(item.title),
      source: item.source,
      source_url: item.source_url,
      category: item.category ?? null,
      cluster_name: item.title,
      raw_json: {
        cluster_sources: top5[i]?.articles?.map(a => ({ name: a.source, url: a.link })) ?? [],
        image: top5[i]?.articles?.[0]?.image ?? null,
      },
    }))

    const result = await upsertDailyDigest(date, digestItems, 'international')

    if (!result.success) {
      log.error(`Gagal menyimpan ke daily_digest: ${result.error}`)
      return NextResponse.json(
        { error: 'Gagal menyimpan data ke database.', detail: result.error },
        { status: 500 },
      )
    }

    log.info(`Pipeline "Berita International" selesai. ${result.count} item tersimpan untuk tanggal ${date}.`)

    revalidateTag('daily-digest', 'max')
    log.info('Cache tag "daily-digest" berhasil di-revalidate')

    return NextResponse.json({ success: true, date, itemsSaved: result.count, feedType: 'international' })
  } catch (err) {
    log.error('Pipeline "Berita International" gagal dengan error tidak terduga', err)
    return NextResponse.json({ error: 'Pipeline gagal.', detail: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
