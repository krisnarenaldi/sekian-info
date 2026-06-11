/**
 * Supabase query module untuk tabel `daily_digest`
 *
 * Semua query menggunakan Supabase client (parameterized — tidak ada string
 * interpolation ke SQL) sesuai Requirements 13.4.
 *
 * Requirements: 2.4, 8.10, 12.1, 13.4
 */

import { createServerClient } from '../client'

// ─── Types ────────────────────────────────────────────────────────────────────

export const FEED_TYPES = ['indonesia', 'sport', 'international', 'market'] as const
export type FeedType = (typeof FEED_TYPES)[number]

export function isFeedType(value: string): value is FeedType {
  return FEED_TYPES.includes(value as FeedType)
}

export interface DailyDigestItem {
  /** Judul berita singkat */
  title: string
  /** Ringkasan 1 kalimat, max 150 karakter */
  summary: string
  /** Slug URL-friendly yang unik per hari */
  slug: string
  /** Nama sumber berita (misal: "Kompas") */
  source: string
  /** URL artikel asli */
  source_url: string
  /** Kategori: "Nasional" | "Ekonomi" | "Politik" | string lainnya */
  category?: string | null
  /** Nama topik cluster yang dihasilkan LLM (max 4 kata) */
  cluster_name?: string | null
  /** Feed type: "indonesia" | "sport" | "international" | "market" */
  feed_type?: FeedType
  /** Data mentah dari pipeline untuk keperluan debugging / audit */
  raw_json?: Record<string, unknown> | null
}

export interface DailyDigestRow extends DailyDigestItem {
  id: string
  date: string
  feed_type?: FeedType
  created_at: string
}

export interface UpsertResult {
  success: boolean
  count: number
  error?: string
}

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Mengambil semua item digest untuk tanggal tertentu.
 *
 * @param date - Tanggal dalam format ISO 8601 (YYYY-MM-DD)
 * @returns Array `DailyDigestRow`, atau array kosong jika tidak ada data
 */
export async function getDailyDigest(date: string): Promise<DailyDigestRow[]> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('daily_digest')
    .select('*')
    .eq('date', date)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`getDailyDigest failed for date "${date}": ${error.message}`)
  }

  return (data ?? []) as DailyDigestRow[]
}

/**
 * Upsert (insert atau update) kumpulan item digest untuk tanggal tertentu.
 * Menggunakan constraint UNIQUE(date, slug, feed_type) sebagai konflik key.
 *
 * @param date  - Tanggal dalam format ISO 8601 (YYYY-MM-DD)
 * @param items - Array item digest yang akan disimpan
 * @param feedType - Tipe feed: "indonesia" | "sport" | "international" | "market"
 * @returns Hasil upsert dengan jumlah baris yang berhasil disimpan
 */
export async function upsertDailyDigest(
  date: string,
  items: DailyDigestItem[],
  feedType: FeedType = 'indonesia'
): Promise<UpsertResult> {
  if (!isFeedType(feedType)) {
    throw new Error(`Invalid feedType "${feedType}". Expected one of: ${FEED_TYPES.join(', ')}`)
  }

  if (items.length === 0) {
    return { success: true, count: 0 }
  }

  const supabase = createServerClient()

  const rows = items.map((item) => ({
    date,
    title: item.title,
    summary: item.summary,
    slug: item.slug,
    source: item.source,
    source_url: item.source_url,
    category: item.category ?? null,
    cluster_name: item.cluster_name ?? null,
    feed_type: feedType,
    raw_json: item.raw_json ?? null,
  }))

  // Try with feed_type (post-migration).
  // Use the constraint name in case the database schema already has the unique
  // index, and fall back to the old date+slug conflict key when needed.
  let data: any, error: any

  // First try using column list for ON CONFLICT. This is the common case
  // when the migration has been applied and a UNIQUE(date,slug,feed_type)
  // constraint exists.
  try {
    ;({ data, error } = await supabase
      .from('daily_digest')
      .upsert(rows, { onConflict: 'date,slug,feed_type' })
      .select())
  } catch (e) {
    // Supabase client may throw (for example when the DB has no such
    // constraint). Normalize the thrown error so fallback logic can inspect
    // `.message` and decide to retry with the older constraint.
    error = e instanceof Error ? e : new Error(String(e))
    data = null
  }

  // Fallback: if feed_type column doesn't exist yet (pre-migration),
  // or if the unique constraint is still on date+slug only.
  let rowsWithoutFeedType: unknown[] | undefined
  const needsFallback =
    error &&
    (error.message.includes('feed_type') ||
      error.message.includes('ON CONFLICT specification') ||
      error.message.includes('no unique or exclusion constraint') ||
      error.message.includes('constraint') )

  if (needsFallback) {
    rowsWithoutFeedType = items.map((item) => ({
      date,
      title: item.title,
      summary: item.summary,
      slug: item.slug,
      source: item.source,
      source_url: item.source_url,
      category: item.category ?? null,
      cluster_name: item.cluster_name ?? null,
      raw_json: item.raw_json ?? null,
    }))

    ;({ data, error } = await supabase
      .from('daily_digest')
      .upsert(rowsWithoutFeedType, { onConflict: 'date,slug' })
      .select())
  }

  if (error) {
    return {
      success: false,
      count: 0,
      error: `upsertDailyDigest failed for date "${date}": ${error.message}`,
    }
  }

  return { success: true, count: data?.length ?? rows.length }
}

/**
 * Mengambil semua item digest untuk hari terbaru yang tersedia di database.
 * Berguna untuk fallback ketika data hari ini belum tersedia.
 *
 * @returns Array `DailyDigestRow` untuk tanggal terbaru, atau array kosong
 */
export async function getLatestDailyDigest(): Promise<DailyDigestRow[]> {
  const supabase = createServerClient()

  // Ambil tanggal terbaru terlebih dahulu
  const { data: latestDateRow, error: dateError } = await supabase
    .from('daily_digest')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  if (dateError || !latestDateRow) {
    // Tidak ada data sama sekali
    return []
  }

  // Kembalikan semua item untuk tanggal terbaru tersebut
  const { data, error } = await supabase
    .from('daily_digest')
    .select('*')
    .eq('date', latestDateRow.date)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`getLatestDailyDigest failed: ${error.message}`)
  }

  return (data ?? []) as DailyDigestRow[]
}

/**
 * Mengambil item digest untuk hari terbaru dengan filter berdasarkan feed_type.
 * Fallback ke getLatestDailyDigest() jika kolom feed_type belum ada (pre-migration).
 *
 * @param feedType - Tipe feed: "indonesia" | "sport" | "international" | "market"
 * @returns Array `DailyDigestRow` untuk tanggal terbaru dengan feed_type tertentu, atau array kosong
 */
export async function getLatestDailyDigestByType(
  feedType: FeedType = 'indonesia'
): Promise<DailyDigestRow[]> {
  if (!isFeedType(feedType)) {
    throw new Error(`Invalid feedType "${feedType}". Expected one of: ${FEED_TYPES.join(', ')}`)
  }

  const supabase = createServerClient()

  try {
    // Ambil tanggal terbaru untuk feed_type tertentu
    const { data: latestDateRow, error: dateError } = await supabase
      .from('daily_digest')
      .select('date')
      .eq('feed_type', feedType)
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (dateError) {
      // Jika error (mungkin kolom belum ada), fallback ke getLatestDailyDigest()
      if (feedType === 'indonesia') {
        return await getLatestDailyDigest()
      }
      // Untuk feed_type lain, return empty array jika belum ada data
      return []
    }

    if (!latestDateRow) {
      // Tidak ada data untuk feed_type ini
      return []
    }

    // Kembalikan semua item untuk tanggal terbaru dengan feed_type tertentu
    const { data, error } = await supabase
      .from('daily_digest')
      .select('*')
      .eq('date', latestDateRow.date)
      .eq('feed_type', feedType)
      .order('created_at', { ascending: false })

    if (error) {
      // Fallback jika error
      if (feedType === 'indonesia') {
        return await getLatestDailyDigest()
      }
      return []
    }

    return (data ?? []) as DailyDigestRow[]
  } catch (err) {
    // Jika exception (misal column doesn't exist), fallback
    if (feedType === 'indonesia') {
      return await getLatestDailyDigest()
    }
    // Untuk 'sport', coba infer dari latest global digest dengan keyword match
    if (feedType === 'sport') {
      const all = await getLatestDailyDigest()
      const sportKeys = ['sport', 'olahraga', 'liga', 'timnas', 'piala', 'gol', 'pertandingan', 'penalti', 'sepak', 'basket', 'tenis', 'badminton', 'bulutangkis']
      return all.filter((it) => {
        const src = (it.source ?? '').toString().toLowerCase()
        const title = (it.title ?? '').toString().toLowerCase()
        const summary = (it.summary ?? '').toString().toLowerCase()
        const cluster = Array.isArray(it.raw_json?.cluster_sources)
          ? (it.raw_json.cluster_sources as string[]).join(' · ').toLowerCase()
          : ''

        // Match on source URL/name containing sport, or title/summary/cluster containing sport keywords
        const sourceLooksSport = /sport|olahraga|liga|sepak|bola/.test(src)
        const textLooksSport = sportKeys.some((k) => title.includes(k) || summary.includes(k) || cluster.includes(k))
        return sourceLooksSport || textLooksSport
      })
    }
    return []
  }
}

/**
 * Mengambil satu item digest berdasarkan slug.
 *
 * @param slug - Slug artikel (contoh: "ihsg-turun-tajam-senin-pagi")
 * @returns `DailyDigestRow` jika ditemukan, atau `null` jika tidak ada
 */
export async function getDailyDigestBySlug(
  slug: string
): Promise<DailyDigestRow | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('daily_digest')
    .select('*')
    .eq('slug', slug)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`getDailyDigestBySlug failed for slug "${slug}": ${error.message}`)
  }

  return (data as DailyDigestRow | null) ?? null
}
