/**
 * Supabase query module untuk tabel `stories`
 *
 * Semua query menggunakan Supabase client (parameterized — tidak ada string
 * interpolation ke SQL) sesuai pola existing.
 *
 * Requirements: 1.1, 1.2, 1.4, 2.3, 2.4, 6.1, 6.3, 7.4, 8.1
 */

import { createServerClient } from '../client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type StoryStatus = 'NEW' | 'ACTIVE' | 'RESOLVED'

export interface Story {
  id: string
  title: string
  embedding: number[] | null
  snapshot_count: number
  article_count: number
  source_count: number
  first_seen_at: string   // DATE as ISO string (YYYY-MM-DD)
  last_seen_at: string    // DATE as ISO string (YYYY-MM-DD)
  status: StoryStatus
  created_at: string
  updated_at: string
}

export interface CreateStoryInput {
  title: string
  embedding: number[]
  snapshot_count?: number
  article_count: number
  source_count: number
  first_seen_at: string
  last_seen_at: string
  status?: StoryStatus
}

export interface UpdateStoryInput {
  title?: string
  embedding?: number[]
  snapshot_count?: number
  article_count?: number
  source_count?: number
  last_seen_at?: string
  status?: StoryStatus
}

/** Story enriched with aggregated metrics — digunakan untuk homepage card */
export interface StoryWithMetrics {
  id: string
  title: string
  status: StoryStatus
  first_seen_at: string
  last_seen_at: string
  /** Hari ke-N: last_seen_at - first_seen_at + 1 (inklusif) */
  day_count: number
  /** Total artikel dari semua snapshots story ini */
  total_articles: number
  /** Jumlah media (source_count) dari snapshot terbaru */
  latest_source_count: number
}

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Ambil semua stories dengan status NEW atau ACTIVE, beserta embedding.
 * Digunakan oleh Story Tracker untuk matching cluster harian.
 *
 * Requirements: 1.2, 2.4
 */
export async function findActiveStories(): Promise<Story[]> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .in('status', ['NEW', 'ACTIVE'])
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`findActiveStories failed: ${error.message}`)
  }

  return (data ?? []) as Story[]
}

/**
 * Ambil stories yang sudah stale (tidak update > staleDays hari kalender).
 * Digunakan untuk evaluasi RESOLVED di awal setiap pipeline run.
 *
 * @param today      - Tanggal hari ini dalam WIB (YYYY-MM-DD)
 * @param staleDays  - Threshold hari tanpa update sebelum dianggap RESOLVED (default: 3)
 *
 * Requirements: 2.3, 2.4
 */
export async function findStaleStories(today: string, staleDays = 3): Promise<Story[]> {
  const supabase = createServerClient()

  // last_seen_at < today - staleDays → stale
  const thresholdDate = new Date(today)
  thresholdDate.setDate(thresholdDate.getDate() - staleDays)
  const threshold = thresholdDate.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('stories')
    .select('id, title, first_seen_at, last_seen_at, status, created_at, updated_at')
    .in('status', ['NEW', 'ACTIVE'])
    .lt('last_seen_at', threshold)

  if (error) {
    throw new Error(`findStaleStories failed: ${error.message}`)
  }

  return (data ?? []) as Story[]
}

/**
 * Buat story baru.
 *
 * @param data - Data story yang akan dibuat
 * @returns Story yang baru dibuat
 *
 * Requirements: 1.4
 */
export async function createStory(data: CreateStoryInput): Promise<Story> {
  const supabase = createServerClient()

  const { data: row, error } = await supabase
    .from('stories')
    .insert({
      title: data.title,
      embedding: data.embedding,
      snapshot_count: data.snapshot_count ?? 1,
      article_count: data.article_count,
      source_count: data.source_count,
      first_seen_at: data.first_seen_at,
      last_seen_at: data.last_seen_at,
      status: data.status ?? 'NEW',
    })
    .select()
    .single()

  if (error) {
    throw new Error(`createStory failed: ${error.message}`)
  }

  return row as Story
}

/**
 * Update kolom tertentu pada sebuah story.
 *
 * @param id   - UUID story yang akan diupdate
 * @param data - Field yang akan diubah
 *
 * Requirements: 2.1, 2.3
 */
export async function updateStory(id: string, data: UpdateStoryInput): Promise<void> {
  const supabase = createServerClient()

  const { error } = await supabase
    .from('stories')
    .update(data)
    .eq('id', id)

  if (error) {
    throw new Error(`updateStory failed for id "${id}": ${error.message}`)
  }
}

/**
 * Ambil stories aktif untuk ditampilkan di homepage card "Sedang Berkembang".
 * Dilengkapi dengan metrics: day_count, total_articles, latest_source_count.
 * Filter: status NEW/ACTIVE dengan snapshot dalam 3 hari terakhir.
 * Sort: total_articles DESC. Limit: 5.
 *
 * Requirements: 6.1, 6.3
 */
export async function getActiveStoriesForHomepage(limit = 5): Promise<StoryWithMetrics[]> {
  const supabase = createServerClient()

  // Hitung threshold 3 hari terakhir
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const threshold = threeDaysAgo.toISOString().split('T')[0]

  // Query stories aktif yang punya snapshot dalam 3 hari terakhir
  const { data, error } = await supabase
    .from('stories')
    .select(`
      id,
      title,
      status,
      first_seen_at,
      last_seen_at,
      story_snapshots (
        article_count,
        source_count,
        snapshot_date
      )
    `)
    .in('status', ['NEW', 'ACTIVE'])
    .gte('last_seen_at', threshold)
    .order('last_seen_at', { ascending: false })

  if (error) {
    throw new Error(`getActiveStoriesForHomepage failed: ${error.message}`)
  }

  if (!data || data.length === 0) return []

  // Hitung metrics client-side dari data yang sudah di-fetch
  const withMetrics: StoryWithMetrics[] = data
    .map((story: any) => {
      const snapshots: Array<{ article_count: number; source_count: number; snapshot_date: string }> =
        story.story_snapshots ?? []

      const totalArticles = snapshots.reduce((sum, s) => sum + (s.article_count ?? 0), 0)

      // source_count dari snapshot terbaru
      const latestSnapshot = snapshots.sort(
        (a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
      )[0]
      const latestSourceCount = latestSnapshot?.source_count ?? 0

      // day_count: inklusif dari first_seen_at ke last_seen_at
      const firstMs = new Date(story.first_seen_at).getTime()
      const lastMs = new Date(story.last_seen_at).getTime()
      const dayCount = Math.floor((lastMs - firstMs) / (1000 * 60 * 60 * 24)) + 1

      return {
        id: story.id,
        title: story.title,
        status: story.status as StoryStatus,
        first_seen_at: story.first_seen_at,
        last_seen_at: story.last_seen_at,
        day_count: dayCount,
        total_articles: totalArticles,
        latest_source_count: latestSourceCount,
      }
    })
    .sort((a, b) => b.total_articles - a.total_articles)
    .slice(0, limit)

  return withMetrics
}

/**
 * Ambil satu story berdasarkan UUID.
 *
 * @param id - UUID story
 * @returns Story jika ditemukan, atau null
 *
 * Requirements: 7.4, 7.5
 */
export async function getStoryById(id: string): Promise<Story | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(`getStoryById failed for id "${id}": ${error.message}`)
  }

  return (data as Story | null) ?? null
}

export interface EmergingStory {
  id: string
  title: string
  actual_snapshot_count: number
  snapshots: Array<{
    id: string
    snapshot_date: string
    cluster_name: string
    summary: string | null
  }>
}

export interface StoryListItem {
  id: string
  title: string
  status: StoryStatus
  snapshot_count: number
  article_count: number
  source_count: number
  first_seen_at: string
  last_seen_at: string
}

export interface StoriesForListingResult {
  active: StoryListItem[]
  resolved: StoryListItem[]
  resolvedTotal: number
}

/**
 * Ambil stories untuk halaman direktori /stories.
 * - ACTIVE/NEW: semua, sort last_seen_at DESC
 * - RESOLVED: hanya resolvedLimit terbaru, beserta total count
 *
 * @param resolvedLimit  Jumlah RESOLVED yang ditampilkan (default: 10)
 */
export async function getStoriesForListing(resolvedLimit = 10): Promise<StoriesForListingResult> {
  const supabase = createServerClient()

  const [activeRes, resolvedRes, countRes] = await Promise.all([
    // Semua ACTIVE/NEW
    supabase
      .from('stories')
      .select('id, title, status, snapshot_count, article_count, source_count, first_seen_at, last_seen_at')
      .in('status', ['NEW', 'ACTIVE'])
      .order('last_seen_at', { ascending: false }),

    // RESOLVED — hanya resolvedLimit terbaru
    supabase
      .from('stories')
      .select('id, title, status, snapshot_count, article_count, source_count, first_seen_at, last_seen_at')
      .eq('status', 'RESOLVED')
      .order('last_seen_at', { ascending: false })
      .limit(resolvedLimit),

    // Total count RESOLVED
    supabase
      .from('stories')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'RESOLVED'),
  ])

  if (activeRes.error) throw new Error(`getStoriesForListing (active) failed: ${activeRes.error.message}`)
  if (resolvedRes.error) throw new Error(`getStoriesForListing (resolved) failed: ${resolvedRes.error.message}`)

  return {
    active: (activeRes.data ?? []) as StoryListItem[],
    resolved: (resolvedRes.data ?? []) as StoryListItem[],
    resolvedTotal: countRes.count ?? 0,
  }
}

/**
 * Fetch stories with more than 1 snapshot, ordered by snapshot count DESC.
 */
export async function getEmergingStories(): Promise<EmergingStory[]> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('stories')
    .select(`
      id,
      title,
      story_snapshots (
        id,
        snapshot_date,
        cluster_name,
        summary
      )
    `)

  if (error) {
    throw new Error(`getEmergingStories failed: ${error.message}`)
  }

  if (!data) return []

  const emerging: EmergingStory[] = data
    .map((row: any) => {
      const snapshots = (row.story_snapshots ?? []) as Array<{
        id: string
        snapshot_date: string
        cluster_name: string
        summary: string | null
      }>

      // Sort snapshots chronologically (ascending) for timeline representation
      snapshots.sort(
        (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
      )

      return {
        id: row.id,
        title: row.title,
        actual_snapshot_count: snapshots.length,
        snapshots,
      }
    })
    .filter((s) => s.actual_snapshot_count > 1)
    .sort((a, b) => b.actual_snapshot_count - a.actual_snapshot_count || a.title.localeCompare(b.title))

  return emerging
}