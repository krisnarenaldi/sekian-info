/**
 * Supabase query functions untuk tabel `article_cache`
 *
 * Menyimpan dan mengambil cache ringkasan artikel on-demand yang dihasilkan
 * oleh pipeline `/api/news/[slug]` saat pengguna membuka halaman detail artikel.
 *
 * Menggunakan upsert dengan `onConflict: 'slug'` agar operasi idempoten —
 * aman untuk dipanggil ulang tanpa menimbulkan error duplicate key.
 *
 * Requirements: 7.3, 11.4, 12.5, 13.4
 */

import { createServerClient } from '../client'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Data yang diperlukan saat menyimpan artikel ke cache.
 */
export interface ArticleCacheInput {
  /** Slug unik artikel, cocok dengan pola `/^[a-z0-9-]{1,200}$/` */
  slug: string
  /** Judul artikel */
  title: string
  /** Ringkasan artikel hasil LLM (2–3 paragraf), atau null jika tidak tersedia */
  summary: string | null
  /** Daftar poin penting dari artikel (maks. 5 item), atau null jika tidak tersedia */
  key_points: string[] | null
  /** URL artikel sumber asli */
  source_url: string
  /** Nama sumber/publikasi artikel, atau null jika tidak diketahui */
  source_name: string | null
}

/**
 * Baris lengkap dari tabel `article_cache`, termasuk kolom yang di-generate DB.
 */
export interface ArticleCacheRow extends ArticleCacheInput {
  /** UUID baris, di-generate oleh database */
  id: string
  /** Timestamp saat baris dibuat, dalam format ISO 8601 */
  created_at: string
}

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Ambil artikel dari cache berdasarkan slug.
 *
 * @param slug - Slug artikel (contoh: `"ekonomi-ihsg-naik-hari-ini"`)
 * @returns Baris `article_cache` yang cocok, atau `null` jika belum ada di cache
 */
export async function getArticleBySlug(slug: string): Promise<ArticleCacheRow | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('article_cache')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw new Error(`getArticleBySlug failed for slug "${slug}": ${error.message}`)
  }

  return data as ArticleCacheRow | null
}

/**
 * Simpan artikel ke cache. Menggunakan upsert dengan `onConflict: 'slug'`
 * sehingga aman dipanggil ulang tanpa memunculkan error duplicate key —
 * jika slug sudah ada, baris yang ada akan diperbarui.
 *
 * @param data - Data artikel yang akan di-cache
 * @returns Baris `article_cache` yang baru disimpan
 */
export async function insertArticleCache(data: ArticleCacheInput): Promise<ArticleCacheRow> {
  const supabase = createServerClient()

  const { data: row, error } = await supabase
    .from('article_cache')
    .upsert(data, { onConflict: 'slug' })
    .select()
    .single()

  if (error) {
    throw new Error(`insertArticleCache failed for slug "${data.slug}": ${error.message}`)
  }

  return row as ArticleCacheRow
}
