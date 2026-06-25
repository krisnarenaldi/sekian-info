/**
 * POST /api/cron/tracked-stories — Pipeline "Tracked Stories"
 *
 * Dijadwalkan oleh Vercel Cron setiap hari pukul 06:15 WIB (23:15 UTC),
 * 15 menit setelah pipeline Indonesia Hari Ini selesai.
 *
 * Alur pipeline:
 *   1. Validasi CRON_SECRET (Bearer token di header Authorization)
 *   2. Cek apakah daily_digest hari ini sudah tersedia
 *      → Jika belum: log warning, return HTTP 200 { status: 'skipped', reason: 'daily_digest_not_ready' }
 *   3. Konversi DailyDigestRow[] → ClusterWithArticles[]
 *   4. Jalankan runStoryTracker(clusters)
 *   5. Log ringkasan eksekusi
 *   6. Return HTTP 200 { status: 'ok', ...result }
 *
 * Error handling:
 *   - Kegagalan pipeline ini tidak mempengaruhi pipeline lain (Req 4.5)
 *   - Semua error ditangkap dan di-log — tidak ada unhandled rejection
 *   - Vercel Cron hanya melihat HTTP 200 (tidak ada 5xx)
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 9.2, 10.1, 10.4
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client'
import { getDailyDigest, type DailyDigestRow } from '@/lib/supabase/queries/daily-digest'
import { runStoryTracker, type ClusterWithArticles } from '@/lib/pipeline/story-tracker'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger('tracked-stories-cron')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Kembalikan tanggal hari ini dalam format YYYY-MM-DD (WIB / UTC+7).
 * Konsisten dengan pola getTodayWIB() di cron routes lain.
 */
function getTodayWIB(): string {
  const now = new Date()
  const wibOffset = 7 * 60 * 60 * 1000
  const wibDate = new Date(now.getTime() + wibOffset)
  return wibDate.toISOString().slice(0, 10)
}

/**
 * Tipe untuk source artikel di raw_json.cluster_sources
 */
interface ClusterSource {
  name?: string
  url?: string
  title?: string
  description?: string
}

/**
 * Konversi DailyDigestRow ke ClusterWithArticles.
 *
 * article_count  = jumlah entri di raw_json.cluster_sources
 * source_count   = jumlah nama sumber unik di raw_json.cluster_sources
 * articles       = daftar artikel (title + description) untuk generateClusterMetadata
 *
 * Jika raw_json tidak tersedia, kedua nilai di-fallback ke 0 sehingga
 * cluster ini akan diskip oleh Story Tracker (threshold: masing-masing ≥ 2).
 */
function digestRowToCluster(row: DailyDigestRow): ClusterWithArticles {
  const clusterSources = Array.isArray(row.raw_json?.cluster_sources)
    ? (row.raw_json.cluster_sources as ClusterSource[])
    : []

  const articleCount = clusterSources.length

  const uniqueSources = new Set(
    clusterSources.map((s) => (s.name ?? '').trim()).filter(Boolean),
  )
  const sourceCount = uniqueSources.size

  // Ekstrak articles untuk LLM metadata generation
  const articles = clusterSources.map((s) => ({
    title: s.title ?? '',
    description: s.description ?? '',
  }))

  return {
    title: row.cluster_name ?? row.title,
    article_count: articleCount,
    source_count: sourceCount,
    articles,
  }
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(req: Request): Promise<NextResponse> {
  // ── 1. Validasi CRON_SECRET ────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  const expectedToken = process.env.CRON_SECRET

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    log.warn('Unauthorized request — invalid or missing CRON_SECRET')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = getTodayWIB()
  log.info(`Pipeline Tracked Stories dimulai untuk tanggal ${today}`)

  try {
    // ── 2. Health check: pastikan tabel stories ada (Req 9.4) ──────────────
    // Jika migrasi belum dijalankan, return HTTP 503 agar tidak menyebabkan
    // error pada pipeline lain.
    try {
      const supabase = createServerClient()
      const { error: healthError } = await supabase
        .from('stories')
        .select('id', { count: 'exact', head: true })
        .limit(1)

      if (healthError && healthError.message?.includes('relation') && healthError.message?.includes('does not exist')) {
        log.warn('Tabel "stories" belum tersedia di database — pipeline Tracked Stories dilewati')
        return NextResponse.json(
          { status: 'unavailable', reason: 'tabel_stories_belum_ada' },
          { status: 503 },
        )
      }
    } catch (healthErr) {
      // Jika health check gagal karena alasan lain, catat dan lanjutkan
      // agar pipeline tetap bisa jalan jika tabel sudah ada
      log.warn('Health check tabel stories gagal, melanjutkan pipeline', healthErr)
    }

    // ── 3. Cek daily_digest hari ini (opsional) ─────────────────────────────
    // Jika daily_digest belum tersedia, pipeline tetap jalan dengan cluster
    // kosong agar stale story resolution tetap berfungsi.
    let clusters: ClusterWithArticles[] = []

    const todayDigest = await getDailyDigest(today)

    if (todayDigest && todayDigest.length > 0) {
      log.info(`${todayDigest.length} item daily_digest ditemukan untuk tanggal ${today}`)

      // ── 3. Konversi ke ClusterWithArticles ────────────────────────────────
      clusters = todayDigest.map(digestRowToCluster)
      log.info(`${clusters.length} cluster disiapkan untuk Story Tracker`)
    } else {
      log.warn(
        `daily_digest untuk tanggal ${today} belum tersedia — pipeline tetap jalan tanpa cluster baru`,
      )
    }

    // ── 4. Jalankan Story Tracker ────────────────────────────────────────────
    // Req 4.3: Story Tracker menerima clusters dari pipeline existing.
    // Error per-cluster sudah ditangani di dalam runStoryTracker (Req 10.2).
    const result = await runStoryTracker(clusters)

    // ── 5. Log ringkasan eksekusi ────────────────────────────────────────────
    // Req 10.4: Catat jumlah story baru, diperbarui, resolved, dan error.
    log.info(
      `Pipeline Tracked Stories selesai — ` +
      `storiesCreated: ${result.storiesCreated}, ` +
      `storiesUpdated: ${result.storiesUpdated}, ` +
      `storiesResolved: ${result.storiesResolved}, ` +
      `snapshotsWritten: ${result.snapshotsWritten}, ` +
      `errors: ${result.errors}`,
    )

    // ── 6. Return ringkasan eksekusi ─────────────────────────────────────────
    return NextResponse.json({ status: 'ok', ...result })
  } catch (err) {
    // Req 4.5: Kegagalan pipeline Tracked Stories tidak mempengaruhi pipeline lain.
    // Req 10.1: Catat error ke log dengan informasi lengkap.
    // Kembalikan HTTP 200 agar Vercel Cron tidak menandai run ini sebagai failure.
    log.error(
      `Pipeline Tracked Stories gagal dengan error tidak terduga untuk tanggal ${today}`,
      err,
    )
    return NextResponse.json(
      {
        status: 'error',
        reason: err instanceof Error ? err.message : String(err),
      },
      { status: 200 },
    )
  }
}