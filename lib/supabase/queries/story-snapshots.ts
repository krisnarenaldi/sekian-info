/**
 * Supabase query module untuk tabel `story_snapshots`
 *
 * Semua query menggunakan Supabase client (parameterized — tidak ada string
 * interpolation ke SQL) sesuai pola existing.
 *
 * Requirements: 3.1, 3.3, 3.4, 3.5, 7.3, 8.2
 */

import { createServerClient } from '../client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StorySnapshot {
  id: string
  story_id: string
  snapshot_date: string   // DATE as ISO string (YYYY-MM-DD)
  cluster_name: string
  embedding: number[]
  article_count: number
  source_count: number
  summary: string | null  // NULL jika LLM gagal generate
  entities: unknown[]
  keywords: string[]
  created_at: string
}

export interface UpsertSnapshotInput {
  story_id: string
  snapshot_date: string
  cluster_name: string
  embedding: number[]
  article_count: number
  source_count: number
  summary: string | null
  entities?: unknown[]
  keywords?: string[]
}

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Cari snapshot berdasarkan story_id dan snapshot_date.
 * Digunakan oleh Story Snapshot Writer untuk cek idempoten sebelum LLM call.
 *
 * @param storyId - UUID story
 * @param date    - Tanggal snapshot (YYYY-MM-DD)
 * @returns StorySnapshot jika ditemukan, atau null
 *
 * Requirements: 3.4, 5.3
 */
export async function findSnapshot(
  storyId: string,
  date: string
): Promise<StorySnapshot | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('story_snapshots')
    .select('*')
    .eq('story_id', storyId)
    .eq('snapshot_date', date)
    .maybeSingle()

  if (error) {
    throw new Error(
      `findSnapshot failed for story "${storyId}" on "${date}": ${error.message}`
    )
  }

  return (data as StorySnapshot | null) ?? null
}

/**
 * Upsert snapshot — INSERT baru, atau UPDATE jika kombinasi
 * (story_id, snapshot_date) sudah ada. Kolom yang diperbarui saat konflik:
 * cluster_name, embedding, article_count, source_count, summary, entities, keywords.
 *
 * Memastikan tidak ada duplikasi snapshot sesuai constraint
 * UNIQUE(story_id, snapshot_date) di database.
 *
 * @param data - Data snapshot yang akan di-upsert
 *
 * Requirements: 3.3, 3.4, 3.5
 */
export async function upsertSnapshot(data: UpsertSnapshotInput): Promise<void> {
  const supabase = createServerClient()

  const { error } = await supabase
    .from('story_snapshots')
    .upsert(
      {
        story_id:      data.story_id,
        snapshot_date: data.snapshot_date,
        cluster_name:  data.cluster_name,
        embedding:     data.embedding,
        article_count: data.article_count,
        source_count:  data.source_count,
        summary:       data.summary,
        entities:      data.entities ?? [],
        keywords:      data.keywords ?? [],
      },
      {
        onConflict:        'story_id,snapshot_date',
        ignoreDuplicates:  false,   // update on conflict
      }
    )

  if (error) {
    throw new Error(
      `upsertSnapshot failed for story "${data.story_id}" on "${data.snapshot_date}": ${error.message}`
    )
  }
}

/**
 * Ambil semua snapshots untuk sebuah story, diurutkan dari terbaru ke terlama.
 * Digunakan oleh halaman detail story untuk merender timeline.
 *
 * @param storyId - UUID story
 * @returns Array StorySnapshot diurutkan snapshot_date DESC
 *
 * Requirements: 7.3, 8.2
 */
export async function getSnapshotsForStory(storyId: string): Promise<StorySnapshot[]> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('story_snapshots')
    .select('*')
    .eq('story_id', storyId)
    .order('snapshot_date', { ascending: false })

  if (error) {
    throw new Error(
      `getSnapshotsForStory failed for story "${storyId}": ${error.message}`
    )
  }

  return (data ?? []) as StorySnapshot[]
}