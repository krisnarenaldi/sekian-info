/**
 * Story Tracker — deteksi dan pelacakan story lintas-hari dari cluster berita harian.
 *
 * Tanggung jawab utama:
 *   1. Evaluasi RESOLVED: tandai story yang sudah lama tidak muncul (> 3 hari)
 *   2. Load active stories (NEW + ACTIVE) beserta embedding
 *   3. Per cluster: hitung cosine similarity + title overlap → match atau buat story baru
 *   4. Tulis snapshot harian via Story Snapshot Writer
 *
 * Revisi dari Python script:
 *   - Dua threshold matching: cosine similarity ≥ 0.80 AND title overlap ≥ 2 token
 *   - Weighted moving average embedding saat update (snapshot_count sebagai bobot)
 *   - generateClusterMetadata() untuk dapat cluster_name, summary, entities, keywords
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5,
 *               4.3, 9.1, 10.2
 */

import { createLogger } from '../utils/logger'
import { cosineSimilarity } from '../utils/cosine-similarity'
import { batchEmbed } from './embedding-engine'
import { writeSnapshot } from './story-snapshot-writer'
import { generateClusterMetadata } from './llm-summarizer'
import {
  findActiveStories,
  findStaleStories,
  createStory,
  updateStory,
  type Story,
} from '../supabase/queries/stories'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Shape minimal cluster yang dibutuhkan oleh Story Tracker.
 * Cocok dengan DailyDigestRow dari pipeline existing — caller bertanggung jawab
 * menyediakan article_count dan source_count (bisa dari raw_json atau field lain).
 */
export interface ClusterForTracking {
  /** Judul cluster — digunakan sebagai judul story dan input LLM */
  title: string
  /** Jumlah artikel dalam cluster hari ini */
  article_count: number
  /** Jumlah sumber/media unik dalam cluster hari ini */
  source_count: number
}

/**
 * Artikel individual dengan minimal title dan opsional description.
 * Digunakan oleh generateClusterMetadata untuk prompt LLM.
 */
export interface ArticleForMetadata {
  title: string
  description?: string
}

/**
 * Extended cluster dengan daftar artikel untuk LLM metadata generation.
 */
export interface ClusterWithArticles extends ClusterForTracking {
  /** Daftar artikel dalam cluster (minimal title) */
  articles: ArticleForMetadata[]
}

/** Ringkasan hasil eksekusi satu run Story Tracker */
export interface StoryTrackerResult {
  storiesCreated: number
  storiesUpdated: number
  storiesResolved: number
  snapshotsWritten: number
  errors: number
}

// ---------------------------------------------------------------------------
// Constants — diselaraskan dengan Python script
// ---------------------------------------------------------------------------

const PIPELINE_NAME = 'tracked-stories'
/** Threshold cosine similarity untuk mencocokkan cluster ke story existing — Python: 0.80 */
const EMBEDDING_THRESHOLD = 0.80
/** Minimum token overlap untuk title matching — Python: MIN_TITLE_OVERLAP = 2 */
const MIN_TITLE_OVERLAP = 2
/** Jumlah hari tanpa update sebelum story ditandai RESOLVED */
const STALE_DAYS = 3
/** Minimum article_count agar cluster diproses (Req 1.5) */
const MIN_ARTICLE_COUNT = 2
/** Minimum source_count agar cluster diproses (Req 1.5) */
const MIN_SOURCE_COUNT = 2

// Indonesia stopwords — disalin dari Python script
const STOPWORDS = new Set([
  'ada', 'di', 'ke', 'dari', 'dan', 'yang', 'pada', 'kepada', 'untuk', 'oleh',
  'soal', 'terkait', 'karena', 'hingga', 'sehingga', 'sampai', 'sebab', 'para',
  'pasti', 'atau', 'atas', 'dengan', 'ia', 'bahwa', 'sebagai', 'masih', 'akan',
  'juga', 'dalam', 'bahwa', 'hanya', 'jika', 'kalau', 'andai', 'setelah',
  'belum', 'sebelum', 'agar', 'supaya', 'lain', 'begitu', 'begini', 'yaitu',
  'yakni', 'maka', 'tentag', 'demi', 'dimana', 'mana', 'kemana', 'kecuali',
  'selain', 'agak', 'tapi', 'ingin', 'mau',
])

const log = createLogger(PIPELINE_NAME)

// ---------------------------------------------------------------------------
// Internal helpers — mencerminkan Python script
// ---------------------------------------------------------------------------

/**
 * Kembalikan tanggal hari ini dalam format YYYY-MM-DD (UTC).
 * Konsisten dengan pola todayISO() di pipeline existing.
 */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Normalisasi teks: lowercase, ekstrak token alfanumerik, hapus stopwords dan
 * token pendek (≤ 2 karakter). Mencerminkan normalize_token() di Python.
 */
function normalizeToken(text?: string | null): Set<string> {
  if (!text) return new Set()
  const lower = text.toLowerCase()
  const tokens = lower.match(/[a-zA-Z0-9]+/g) ?? []
  const filtered = tokens.filter(
    (tok) => !STOPWORDS.has(tok) && tok.length > 2,
  )
  return new Set(filtered)
}

/**
 * Hitung overlap token antara dua judul setelah normalisasi.
 * Mencerminkan title_overlap() di Python.
 */
function titleOverlap(titleA: string, titleB: string): number {
  const tokensA = normalizeToken(titleA)
  const tokensB = normalizeToken(titleB)
  let overlap = 0
  for (const tok of tokensA) {
    if (tokensB.has(tok)) overlap++
  }
  return overlap
}

/**
 * Hitung weighted moving average embedding untuk update story.
 * Mencerminkan logika di update_story() Python:
 *   new_embedding = (old_embedding * old_snapshot_count + cluster_embedding) / new_snapshot_count
 */
function weightedAverageEmbedding(
  oldEmbedding: number[],
  oldSnapshotCount: number,
  newEmbedding: number[],
): number[] {
  const total = oldSnapshotCount + 1
  return oldEmbedding.map(
    (val, i) => (val * oldSnapshotCount + newEmbedding[i]) / total,
  )
}

/**
 * Cari top 5 story yang paling cocok dengan embedding cluster.
 * Mencerminkan find_best_story() di Python yang return top 5 candidates.
 */
function findBestStories(
  clusterEmbedding: number[],
  activeStories: Story[],
): Array<{ story: Story; score: number }> {
  const candidates: Array<{ story: Story; score: number }> = []

  for (const story of activeStories) {
    // Story tanpa embedding tidak dapat dicocokkan — lewati
    if (!story.embedding || story.embedding.length === 0) {
      continue
    }

    let score: number
    try {
      score = cosineSimilarity(clusterEmbedding, story.embedding)
    } catch {
      // Dimensi tidak cocok — lewati story ini
      continue
    }

    candidates.push({ story, score })
  }

  // Sort descending by score
  candidates.sort((a, b) => b.score - a.score)

  // Return top 5 (Python hanya pakai matches[0], tapi top 5 untuk debug)
  return candidates.slice(0, 5)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Jalankan pipeline Story Tracker untuk satu set cluster harian.
 *
 * Alur eksekusi:
 *   Step 1 — Evaluasi RESOLVED: tandai story yang stale (> STALE_DAYS hari tanpa update)
 *   Step 2 — Load active stories (NEW + ACTIVE) beserta embedding dari DB
 *   Step 3 — Per cluster:
 *     a. Skip cluster kecil (article_count < 2 atau source_count < 2)
 *     b. Generate embedding judul cluster
 *     c. Generate metadata via LLM (cluster_name, summary, entities, keywords)
 *     d. Panggil LLM untuk cluster_name + summary
 *     e. Cari story existing dengan cosine similarity ≥ 0.80 + title overlap ≥ 2
 *     f. Jika match: weighted avg embedding, update status ACTIVE + akumulasi metrik
 *        Jika tidak: buat story baru dengan status NEW
 *     g. Tulis snapshot harian
 *
 * Error per cluster dicatat dan dilanjutkan — tidak menghentikan seluruh pipeline.
 *
 * @param clusters - Array cluster dengan artikel (extended) dari pipeline Indonesia Hari Ini
 * @param today    - Tanggal hari ini (YYYY-MM-DD). Opsional — default ke todayISO()
 * @returns Ringkasan eksekusi: jumlah story created/updated/resolved, snapshot, error
 *
 * Requirements: 1.1–1.6, 2.1–2.5, 4.3, 9.1, 10.2
 */
export async function runStoryTracker(
  clusters: ClusterWithArticles[],
  today: string = todayISO(),
): Promise<StoryTrackerResult> {
  const result: StoryTrackerResult = {
    storiesCreated: 0,
    storiesUpdated: 0,
    storiesResolved: 0,
    snapshotsWritten: 0,
    errors: 0,
  }

  log.info(`Story Tracker dimulai untuk tanggal ${today}, ${clusters.length} cluster masuk`)

  // ── Step 1: Evaluasi RESOLVED ─────────────────────────────────────────────
  // Jalankan SEBELUM matching hari ini agar story stale tidak ikut dicocokkan.
  // Requirements: 2.3, 2.4
  try {
    const staleStories = await findStaleStories(today, STALE_DAYS)
    log.info(`Step 1/4: ${staleStories.length} story stale ditemukan untuk ditandai RESOLVED`)

    for (const story of staleStories) {
      try {
        await updateStory(story.id, { status: 'RESOLVED' })
        result.storiesResolved++
        log.info(`Story "${story.title}" (${story.id}) ditandai RESOLVED (last_seen_at: ${story.last_seen_at})`)
      } catch (err) {
        log.error(`Gagal update status RESOLVED untuk story "${story.id}"`, err)
        result.errors++
      }
    }
  } catch (err) {
    // Kegagalan evaluasi RESOLVED tidak menghentikan matching — catat dan lanjut
    log.error('Gagal mengevaluasi story stale (Step 1). Melanjutkan ke Step 2.', err)
    result.errors++
  }

  // ── Step 2: Load active stories beserta embedding ─────────────────────────
  // Requirements: 1.2
  let activeStories: Story[] = []
  try {
    activeStories = await findActiveStories()
    log.info(`Step 2/4: ${activeStories.length} active story dimuat dari database`)
  } catch (err) {
    // Jika gagal load active stories, matching tidak dapat dilanjutkan
    log.error('Gagal memuat active stories dari database. Pipeline dihentikan.', err)
    result.errors++
    return result
  }

  // ── Step 3 & 4: Proses setiap cluster ────────────────────────────────────
  // Requirements: 1.1, 1.3–1.6, 2.1, 2.2, 10.2
  log.info(`Step 3-4/4: Memproses ${clusters.length} cluster`)

  for (const cluster of clusters) {
    try {
      // ── 3a. Skip cluster yang terlalu kecil (Req 1.5) ────────────────────
      if (cluster.article_count < MIN_ARTICLE_COUNT || cluster.source_count < MIN_SOURCE_COUNT) {
        log.info(
          `Cluster "${cluster.title}" dilewati: article_count=${cluster.article_count}, ` +
          `source_count=${cluster.source_count} (minimum: ${MIN_ARTICLE_COUNT}/${MIN_SOURCE_COUNT})`,
        )
        continue
      }

      // ── 3b. Generate embedding untuk judul cluster (Req 1.2) ────────────
      let clusterEmbedding: number[]
      try {
        const embeddings = await batchEmbed([cluster.title])
        clusterEmbedding = embeddings[0]
      } catch (embErr) {
        // Req 10.2: catat error embedding, lewati cluster ini, lanjut
        log.error(`Gagal generate embedding untuk cluster "${cluster.title}"`, embErr)
        result.errors++
        continue
      }

      // ── 3c. Generate metadata via LLM ──────────────────────────────────
      // cluster_name, summary, entities, keywords — satu panggilan LLM
      // Mencerminkan prompt Python script yang lama.
      let clusterName: string
      let clusterSummary: string
      let clusterEntities: unknown[]
      let clusterKeywords: string[]
      try {
        const metadata = await generateClusterMetadata(cluster.articles)
        clusterName = metadata.cluster_name || cluster.title
        clusterSummary = metadata.summary
        clusterEntities = metadata.entities
        clusterKeywords = metadata.keywords
      } catch (metaErr) {
        log.error(`Gagal generate metadata untuk cluster "${cluster.title}"`, metaErr)
        result.errors++
        continue
      }

      // ── 3d. Cari story existing dengan cosine similarity + title overlap ──
      // Mencerminkan logika matching di Python script:
      //   - find_best_story() → ambil top 5 candidates
      //   - Ambil matches[0] sebagai best_story
      //   - Cek: best_score >= EMBEDDING_THRESHOLD && title_overlap >= MIN_TITLE_OVERLAP
      const candidates = findBestStories(clusterEmbedding, activeStories)

      let storyId: string

      if (candidates.length > 0) {
        const { story: matchedStory, score: bestScore } = candidates[0]
        const overlapCount = titleOverlap(clusterName, matchedStory.title)

        log.info(
          `Cluster "${clusterName}" vs story "${matchedStory.title}": ` +
          `score=${bestScore.toFixed(4)}, overlap=${overlapCount}`,
        )

        // DUAL THRESHOLD: cosine similarity ≥ 0.80 AND title overlap ≥ 2
        if (bestScore >= EMBEDDING_THRESHOLD && overlapCount >= MIN_TITLE_OVERLAP) {
          // ── MATCH: Update story existing ────────────────────────────────
          // Weighted moving average embedding (mencerminkan Python update_story)
          const newSnapshotCount = (matchedStory.snapshot_count ?? 0) + 1
          const newEmbedding = weightedAverageEmbedding(
            matchedStory.embedding as number[],
            matchedStory.snapshot_count ?? 0,
            clusterEmbedding,
          )

          await updateStory(matchedStory.id, {
            last_seen_at: today,
            status: 'ACTIVE',
            embedding: newEmbedding,
            snapshot_count: newSnapshotCount,
            article_count: (matchedStory.article_count ?? 0) + cluster.article_count,
            source_count: maxSourceCount(matchedStory.source_count ?? 0, cluster.source_count),
          })

          // Perbarui in-memory agar iterasi berikutnya pakai data terbaru
          matchedStory.last_seen_at = today
          matchedStory.status = 'ACTIVE'
          matchedStory.embedding = newEmbedding
          matchedStory.snapshot_count = newSnapshotCount
          matchedStory.article_count = (matchedStory.article_count ?? 0) + cluster.article_count
          matchedStory.source_count = maxSourceCount(matchedStory.source_count ?? 0, cluster.source_count)

          storyId = matchedStory.id
          result.storiesUpdated++
          log.info(
            `MATCH: Cluster "${clusterName}" → story "${matchedStory.title}" (${matchedStory.id}), ` +
            `score=${bestScore.toFixed(4)}, overlap=${overlapCount}, snapshot=${newSnapshotCount}`,
          )
        } else {
          // ── NO MATCH: Buat story baru ───────────────────────────────────
          const reason = bestScore < EMBEDDING_THRESHOLD
            ? `score ${bestScore.toFixed(4)} < threshold ${EMBEDDING_THRESHOLD}`
            : `overlap ${overlapCount} < minimum ${MIN_TITLE_OVERLAP}`

          const newStory = await createStory({
            title: clusterName,
            embedding: clusterEmbedding,
            article_count: cluster.article_count,
            source_count: cluster.source_count,
            first_seen_at: today,
            last_seen_at: today,
            status: 'NEW',
          })

          storyId = newStory.id
          activeStories.push(newStory)

          result.storiesCreated++
          log.info(
            `NEW STORY: Cluster "${clusterName}" → story baru (${newStory.id}). ` +
            `Best match "${candidates[0].story.title}" rejected: ${reason}`,
          )
        }
      } else {
        // ── NO CANDIDATES AT ALL: Buat story baru ──────────────────────────
        // Tidak ada active stories sama sekali (first run atau semua RESOLVED)
        log.info(`Tidak ada candidate story. Cluster "${clusterName}" → story baru.`)

        const newStory = await createStory({
          title: clusterName,
          embedding: clusterEmbedding,
          article_count: cluster.article_count,
          source_count: cluster.source_count,
          first_seen_at: today,
          last_seen_at: today,
          status: 'NEW',
        })

        storyId = newStory.id
        activeStories.push(newStory)

        result.storiesCreated++
        log.info(`Cluster "${clusterName}" → story baru dibuat (${newStory.id}), status: NEW`)
      }

      // ── 3e. Tulis snapshot harian (Req 3.1) ──────────────────────────────
      // Sertakan embedding, summary, entities, keywords
      await writeSnapshot(
        storyId,
        {
          title: clusterName,
          article_count: cluster.article_count,
          source_count: cluster.source_count,
        },
        today,
        clusterEmbedding,
        {
          summary: clusterSummary,
          entities: clusterEntities,
          keywords: clusterKeywords,
        },
      )
      result.snapshotsWritten++
      log.info(`Snapshot ditulis untuk story "${storyId}" pada ${today}`)
    } catch (err) {
      // Req 10.2: tangkap error per cluster, catat, lanjut ke cluster berikutnya
      log.error(`Error saat memproses cluster "${cluster.title}"`, err)
      result.errors++
    }
  }

  // Ringkasan eksekusi (Req 10.4)
  log.info(
    `Story Tracker selesai — created: ${result.storiesCreated}, ` +
    `updated: ${result.storiesUpdated}, resolved: ${result.storiesResolved}, ` +
    `snapshots: ${result.snapshotsWritten}, errors: ${result.errors}`,
  )

  return result
}

/**
 * Helper untuk max source_count. Python menggunakan max().
 */
function maxSourceCount(a: number, b: number): number {
  return a > b ? a : b
}