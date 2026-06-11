/**
 * Embedding engine — menghasilkan vector embeddings dari teks.
 *
 * Menggunakan OpenAI text-embedding-3-small via LiteLLM proxy
 * (endpoint yang sama dengan llm-summarizer).
 *
 * Requirements: 8.4
 */

import OpenAI from 'openai'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger('embedding-engine')

const EMBEDDING_MODEL = 'text-embedding-3-small'

/** Batch size untuk concurrent embedding API calls */
const BATCH_SIZE = 20

// ---------------------------------------------------------------------------
// OpenAI client via LiteLLM proxy
// ---------------------------------------------------------------------------

function createEmbeddingClient(): OpenAI {
  const apiKey = process.env.LLMLITE_KEY
  if (!apiKey) {
    throw new Error('Missing environment variable: LLMLITE_KEY')
  }
  return new OpenAI({
    apiKey,
    baseURL: 'http://litellm.koboi2026.biz.id/v1',
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Embed sekelompok teks menjadi vector representasi semantik.
 *
 * Menggunakan text-embedding-3-small via LiteLLM proxy.
 * Urutan output dijamin sama dengan urutan input.
 *
 * @param texts - Array string yang akan di-embed
 * @returns Promise resolving ke array embedding vectors, satu per input
 *
 * Requirements: 8.4
 */
export async function batchEmbed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

  const client = createEmbeddingClient()
  log.info(`Embedding ${texts.length} text(s) dengan ${EMBEDDING_MODEL}`)

  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)

    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      })

      // Pastikan urutan output sesuai index
      const batchVectors = response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding)

      results.push(...batchVectors)
      log.info(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchVectors.length} embeddings selesai`)
    } catch (err) {
      log.error(`Embedding gagal untuk batch index ${i}`, err)
      throw err
    }
  }

  return results
}
