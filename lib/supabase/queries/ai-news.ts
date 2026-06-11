/**
 * Supabase query functions untuk tabel `ai_news_digest`
 *
 * Menyimpan dan mengambil ringkasan berita AI harian (OpenAI, Anthropic, Google AI, dll.)
 * yang dihasilkan oleh pipeline cron `/api/cron/ai-news`.
 *
 * Requirements: 4.3, 10.4, 12.3, 13.4
 */

import { createServerClient } from '../client'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Satu item berita AI beserta ringkasan dan penjelasan dampaknya.
 */
export interface AINewsItem {
  /** Judul berita */
  title: string
  /** Ringkasan singkat berita */
  summary: string
  /** Penjelasan dampak bagi developer Indonesia (maks. 3 kalimat) */
  impact: string
  /** Nama organisasi sumber (contoh: "OpenAI", "Anthropic", "Google AI") */
  source: string
  /** URL artikel asli */
  link: string
}

/**
 * Satu baris pada tabel `ai_news_digest`.
 */
export interface AINewsDigestRow {
  id: string
  date: string          // format: "YYYY-MM-DD"
  items: AINewsItem[]
  created_at: string
}

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Ambil AI news digest untuk tanggal tertentu.
 *
 * @param date - Tanggal dalam format "YYYY-MM-DD"
 * @returns Baris `ai_news_digest` untuk tanggal tersebut, atau `null` jika tidak ada
 */
export async function getAINewsDigest(date: string): Promise<AINewsDigestRow | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('ai_news_digest')
    .select('*')
    .eq('date', date)
    .maybeSingle()

  if (error) {
    throw new Error(`getAINewsDigest failed for date "${date}": ${error.message}`)
  }

  return data as AINewsDigestRow | null
}

/**
 * Upsert (insert atau update) AI news digest untuk tanggal tertentu.
 * Jika baris dengan tanggal tersebut sudah ada, field `items` akan diperbarui.
 *
 * @param date  - Tanggal dalam format "YYYY-MM-DD"
 * @param items - Array item berita AI hasil pipeline LLM
 * @returns Baris yang baru di-upsert
 */
export async function upsertAINewsDigest(
  date: string,
  items: AINewsItem[]
): Promise<AINewsDigestRow> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('ai_news_digest')
    .upsert(
      { date, items },
      { onConflict: 'date' }
    )
    .select()
    .single()

  if (error) {
    throw new Error(`upsertAINewsDigest failed for date "${date}": ${error.message}`)
  }

  return data as AINewsDigestRow
}

/**
 * Ambil baris AI news digest yang paling terbaru (berdasarkan kolom `date` DESC).
 *
 * @returns Baris terbaru dari `ai_news_digest`, atau `null` jika tabel kosong
 */
export async function getLatestAINewsDigest(): Promise<AINewsDigestRow | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('ai_news_digest')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`getLatestAINewsDigest failed: ${error.message}`)
  }

  return data as AINewsDigestRow | null
}
