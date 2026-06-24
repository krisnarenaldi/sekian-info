/**
 * Story Snapshot Writer — menyimpan snapshot harian sebuah story ke database.
 *
 * Tanggung jawab utama:
 *   1. Idempoten: cek apakah snapshot dengan summary valid sudah ada → skip LLM
 *   2. Panggil LLM (summarizeStorySnapshot) untuk menghasilkan ringkasan harian
 *   3. Tangkap error LLM → simpan dengan summary = NULL, lanjut
 *   4. Upsert snapshot ke DB, dengan retry 3x (jeda 1 detik) jika DB write gagal
 *
 * Revisi Python script:
 *   - Parameter ke-5: llmMetadata (summary, entities, keywords dari generateClusterMetadata)
 *   - entities & keywords: dikirim ke upsertSnapshot
 *   - Akumulasi article_count dan source_count jika snapshot hari ini sudah ada
 *
 * Requirements: 3.1, 3.2, 3.4, 3.5, 5.1, 5.3, 10.3
 */

import { createLogger } from '../utils/logger'
import { summarizeStorySnapshot } from './llm-summarizer'
import { findSnapshot, upsertSnapshot } from '../supabase/queries/story-snapshots'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal shape dari sebuah cluster yang dibutuhkan oleh writeSnapshot.
 * Cocok dengan field yang tersedia di DailyDigestItem (via raw_json atau
 * enriched cluster dari story-tracker).
 */
export interface ClusterInput {
  /** Judul / nama cluster (digunakan sebagai cluster_name dan LLM context) */
  title: string
  /** Jumlah artikel dalam cluster pada hari ini */
  article_count: number
  /** Jumlah sumber/media unik dalam cluster pada hari ini */
  source_count: number
}

/**
 * Metadata hasil LLM yang disimpan ke story_snapshots.
 * Berasal dari generateClusterMetadata().
 */
export interface SnapshotLLMMetadata {
  summary: string
  entities: unknown[]
  keywords: string[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIPELINE_NAME = 'tracked-stories'
const DB_RETRY_ATTEMPTS = 3
const DB_RETRY_DELAY_MS = 1_000

const log = createLogger(PIPELINE_NAME)

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Sleep selama `ms` milidetik.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Jalankan `fn` dengan retry hingga `maxAttempts` kali, jeda `delayMs` antar percobaan.
 * Jika semua percobaan gagal, lempar error terakhir.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delayMs: number,
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt < maxAttempts) {
        await sleep(delayMs)
      }
    }
  }
  throw lastErr
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Tulis (atau perbarui) snapshot harian untuk sebuah story.
 *
 * Alur:
 *   1. Cek apakah snapshot sudah ada dengan summary valid → jika ya, skip LLM (idempoten)
 *   2. Upsert snapshot ke DB dengan data dari LLM (summary, entities, keywords) + embedding
 *   3. Jika snapshot hari ini sudah ada: akumulasi article_count dan source_count
 *   4. Retry DB write 3x dengan jeda 1 detik
 *
 * @param storyId     - UUID story yang menjadi target snapshot
 * @param cluster     - Data cluster hari ini (title, article_count, source_count)
 * @param date        - Tanggal snapshot dalam format YYYY-MM-DD
 * @param embedding   - Vector embedding dari judul cluster
 * @param llmMetadata - Metadata dari LLM: summary, entities, keywords (dari generateClusterMetadata)
 *
 * Requirements: 3.1, 3.2, 3.4, 3.5, 5.1, 5.3, 10.3
 */
export async function writeSnapshot(
  storyId: string,
  cluster: ClusterInput,
  date: string,
  embedding: number[],
  llmMetadata: SnapshotLLMMetadata,
): Promise<void> {
  // ── Step 1: Cek apakah snapshot hari ini sudah ada ──────────────────────────
  const existing = await findSnapshot(storyId, date)

  if (existing !== null) {
    // Snapshot hari ini sudah ada — akumulasi article_count dan source_count
    // Mencerminkan logika upsert_snapshot() di Python:
    //   new_article_count = existing.article_count + cluster.article_count
    //   new_source_count = max(existing.source_count, cluster.source_count)
    const newArticleCount = (existing.article_count ?? 0) + cluster.article_count
    const newSourceCount = Math.max(existing.source_count ?? 0, cluster.source_count)

    try {
      await withRetry(
        () =>
          upsertSnapshot({
            story_id: storyId,
            snapshot_date: date,
            cluster_name: cluster.title,
            embedding,
            article_count: newArticleCount,
            source_count: newSourceCount,
            summary: existing.summary ?? llmMetadata.summary ?? null,
            entities: existing.entities?.length ? existing.entities : llmMetadata.entities,
            keywords: existing.keywords?.length ? existing.keywords : llmMetadata.keywords,
          }),
        DB_RETRY_ATTEMPTS,
        DB_RETRY_DELAY_MS,
      )
    } catch (err) {
      log.error(
        `DB upsert (update existing) failed for story "${storyId}" on "${date}" after ${DB_RETRY_ATTEMPTS} attempts`,
        err,
      )
      throw err
    }
    return
  }

  // ── Step 2: Snapshot belum ada — insert baru ───────────────────────────────
  try {
    await withRetry(
      () =>
        upsertSnapshot({
          story_id: storyId,
          snapshot_date: date,
          cluster_name: cluster.title,
          embedding,
          article_count: cluster.article_count,
          source_count: cluster.source_count,
          summary: llmMetadata.summary ?? null,
          entities: llmMetadata.entities,
          keywords: llmMetadata.keywords,
        }),
      DB_RETRY_ATTEMPTS,
      DB_RETRY_DELAY_MS,
    )
  } catch (err) {
    log.error(
      `DB upsert (insert new) failed for story "${storyId}" on "${date}" after ${DB_RETRY_ATTEMPTS} attempts`,
      err,
    )
    throw err
  }
}