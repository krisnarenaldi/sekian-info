/**
 * POST /api/cron/ai-news — Pipeline "AI Hari Ini"
 *
 * Dijadwalkan oleh Vercel Cron setiap hari pukul 06:10 WIB (23:10 UTC).
 * Endpoint ini diamankan dengan `CRON_SECRET` via Authorization header.
 *
 * Alur pipeline:
 *   1. Validasi CRON_SECRET (Bearer token)
 *   2. Fetch RSS dari 5 sumber AI (OpenAI, Anthropic, Google AI, Meta AI, HuggingFace)
 *   3. Jika SEMUA sumber gagal → catat error, pertahankan data kemarin (no-write)
 *   4. Normalisasi item yang berhasil di-fetch
 *   5. Panggil LLM (summarizeAINews) → pilih 3–5 berita paling penting
 *   6. Jika LLM error → catat error, pertahankan data kemarin (no-write)
 *   7. Upsert hasil ke tabel `ai_news_digest`
 *   8. Kembalikan respons JSON success/error
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 11.1
 */

import { NextRequest, NextResponse } from 'next/server'
import { AI_NEWS_SOURCES, fetchRSS } from '@/lib/pipeline/rss-fetcher'
import { normalizeAll } from '@/lib/pipeline/normalizer'
import { summarizeAINews } from '@/lib/pipeline/llm-summarizer'
import { upsertAINewsDigest } from '@/lib/supabase/queries/ai-news'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger('ai-news-cron')

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Step 1: Validasi CRON_SECRET ─────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    log.warn('Unauthorized request — CRON_SECRET mismatch atau tidak ada')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
  log.info(`Pipeline AI Hari Ini dimulai untuk tanggal ${today}`)

  // ── Step 2: Fetch RSS dari semua sumber AI ───────────────────────────────
  log.info(`Mengambil RSS dari ${AI_NEWS_SOURCES.length} sumber AI`)

  // Lacak per-source result agar kita tahu apakah SEMUA gagal
  const fetchResults = await Promise.all(
    AI_NEWS_SOURCES.map(async (source) => {
      const items = await fetchRSS(source.url, 20, 10_000, source.name)
      return { source: source.name, items }
    }),
  )

  const successfulSources = fetchResults.filter((r) => r.items.length > 0)
  const failedSources = fetchResults.filter((r) => r.items.length === 0)

  if (failedSources.length > 0) {
    log.warn(
      `${failedSources.length} sumber gagal di-fetch: ${failedSources.map((s) => s.source).join(', ')}`,
    )
  }

  // ── Step 3: Jika SEMUA sumber gagal → pertahankan data kemarin ────────────
  if (successfulSources.length === 0) {
    log.error(
      'Semua sumber RSS AI gagal di-fetch. Pipeline dihentikan — data kemarin dipertahankan.',
    )
    return NextResponse.json(
      {
        success: false,
        error: 'Semua sumber RSS AI tidak dapat diakses. Data kemarin dipertahankan.',
        date: today,
        sourcesAttempted: AI_NEWS_SOURCES.length,
        sourcesFailed: AI_NEWS_SOURCES.length,
      },
      { status: 200 },
    )
  }

  log.info(
    `Berhasil fetch dari ${successfulSources.length}/${AI_NEWS_SOURCES.length} sumber. Total item mentah: ${successfulSources.reduce((n, r) => n + r.items.length, 0)}`,
  )

  // ── Step 4: Normalisasi item ──────────────────────────────────────────────
  const rawItems = successfulSources.flatMap((r) => r.items)
  const normalizedItems = normalizeAll(rawItems)

  log.info(
    `Normalisasi selesai: ${normalizedItems.length} item valid dari ${rawItems.length} item mentah`,
  )

  if (normalizedItems.length === 0) {
    log.error(
      'Tidak ada item valid setelah normalisasi. Pipeline dihentikan — data kemarin dipertahankan.',
    )
    return NextResponse.json(
      {
        success: false,
        error: 'Tidak ada item valid setelah normalisasi. Data kemarin dipertahankan.',
        date: today,
      },
      { status: 200 },
    )
  }

  // ── Step 5: LLM Summarization ────────────────────────────────────────────
  log.info(`Memanggil LLM untuk merangkum ${normalizedItems.length} item AI news`)

  let aiNewsItems
  try {
    aiNewsItems = await summarizeAINews(normalizedItems)
    log.info(`LLM menghasilkan ${aiNewsItems.length} item AI news digest`)
  } catch (err) {
    // ── Step 6: LLM error → pertahankan data kemarin ────────────────────────
    log.error(
      'LLM gagal merangkum berita AI. Pipeline dihentikan — data kemarin dipertahankan.',
      err,
    )
    return NextResponse.json(
      {
        success: false,
        error: 'LLM error saat merangkum berita AI. Data kemarin dipertahankan.',
        date: today,
      },
      { status: 200 },
    )
  }

  // ── Step 7: Simpan ke ai_news_digest ─────────────────────────────────────
  log.info(`Menyimpan ${aiNewsItems.length} item ke tabel ai_news_digest untuk tanggal ${today}`)

  try {
    await upsertAINewsDigest(today, aiNewsItems)
    log.info(`Data AI news digest berhasil disimpan untuk tanggal ${today}`)
  } catch (err) {
    log.error('Gagal menyimpan data ke ai_news_digest', err)
    return NextResponse.json(
      {
        success: false,
        error: 'Gagal menyimpan data ke database.',
        date: today,
      },
      { status: 500 },
    )
  }

  // ── Step 8: Kembalikan respons sukses ────────────────────────────────────
  log.info(`Pipeline AI Hari Ini selesai dengan sukses untuk tanggal ${today}`)

  return NextResponse.json({
    success: true,
    date: today,
    itemsSaved: aiNewsItems.length,
    sourcesSucceeded: successfulSources.length,
    sourcesFailed: failedSources.length,
    sourcesTotal: AI_NEWS_SOURCES.length,
  })
}
