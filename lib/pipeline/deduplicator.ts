/**
 * Deduplicator — removes semantically duplicate articles using cosine similarity.
 *
 * O(n²) pairwise comparison: articles whose embedding vectors have cosine
 * similarity ≥ threshold are considered duplicates. The first occurrence in
 * the input array is always kept; subsequent duplicates are discarded.
 *
 * Requirements: 8.5
 */

import { cosineSimilarity } from '../utils/cosine-similarity'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Remove duplicate articles from a list based on semantic similarity.
 *
 * For each pair (i, j) where i < j, if cosineSimilarity(embeddings[i], embeddings[j])
 * ≥ threshold then article j is marked as a duplicate and excluded from output.
 * Article i (the earlier one) is always retained.
 *
 * Edge cases:
 * - Empty `articles` array: returns `[]` immediately.
 * - `articles.length !== embeddings.length`: throws an Error.
 *
 * @param articles   - Array of article items (any type T)
 * @param embeddings - Embedding vectors in the same order as `articles`
 * @param threshold  - Similarity threshold above which items are duplicates (default: 0.90)
 * @returns Deduplicated subset of `articles` preserving original order
 *
 * Requirements: 8.5
 */
export function deduplicate<T>(
  articles: T[],
  embeddings: number[][],
  threshold = 0.9,
): T[] {
  if (articles.length === 0) return []

  if (articles.length !== embeddings.length) {
    throw new Error(
      `deduplicate: articles.length (${articles.length}) !== embeddings.length (${embeddings.length})`,
    )
  }

  const isDuplicate = new Set<number>()
  const unique: T[] = []

  for (let i = 0; i < articles.length; i++) {
    if (isDuplicate.has(i)) continue

    unique.push(articles[i])

    for (let j = i + 1; j < articles.length; j++) {
      if (isDuplicate.has(j)) continue

      const sim = cosineSimilarity(embeddings[i], embeddings[j])
      if (sim >= threshold) {
        isDuplicate.add(j)
      }
    }
  }

  return unique
}
