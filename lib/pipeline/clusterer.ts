/**
 * Clusterer — groups related news articles using greedy semantic clustering.
 *
 * Articles whose embedding vectors have cosine similarity ≥ CLUSTER_THRESHOLD
 * are placed in the same cluster. The first article in each cluster acts as
 * the cluster seed; subsequent articles are merged into the seed's cluster if
 * they are similar enough to the seed embedding (greedy single-pass).
 *
 * Requirements: 8.6
 */

import { cosineSimilarity } from '../utils/cosine-similarity'
import type { NormalizedItem } from './normalizer'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum cosine similarity for two articles to be placed in the same cluster. */
export const CLUSTER_THRESHOLD = 0.65

/** Known category keywords (Indonesian) mapped to canonical category names. */
const CATEGORY_MAP: Array<{ keywords: RegExp; category: string }> = [
  {
    keywords: /pemerintah|presiden|indonesia|nasional|dpr|menteri|negara|republik/i,
    category: 'Nasional',
  },
  {
    keywords: /ekonomi|pasar|saham|rupiah|inflasi|bisnis|investasi|perdagangan/i,
    category: 'Ekonomi',
  },
  {
    keywords: /politik|partai|pemilu|pilkada|koalisi|oposisi|kampanye/i,
    category: 'Politik',
  },
]

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ClusterResult {
  /** All articles belonging to this cluster. */
  articles: NormalizedItem[]
  /** Deduplicated list of source names in this cluster. */
  uniqueSources: string[]
  /** The publication timestamp of the most recently published article. */
  latestPublishedAt: Date
  /** Dominant category inferred from article titles/descriptions.
   *  One of: 'Nasional' | 'Ekonomi' | 'Politik' | 'Other'
   *  Defaults to 'Nasional' if no keywords matched. */
  primaryCategory: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Infer the primary category for a cluster by checking each article's title
 * first, then its description, against known keyword patterns.
 *
 * Strategy:
 * - For each article, scan its title. If a category matches, increment that
 *   category's count.
 * - If no title match, scan the description.
 * - The category with the highest total match count wins.
 * - Defaults to 'Nasional' when no pattern matches any article.
 *
 * Requirements: 8.6
 */
function inferCategory(articles: NormalizedItem[]): string {
  const counts: Record<string, number> = {
    Nasional: 0,
    Ekonomi: 0,
    Politik: 0,
  }

  for (const article of articles) {
    let matched = false
    for (const { keywords, category } of CATEGORY_MAP) {
      if (keywords.test(article.title)) {
        counts[category]++
        matched = true
        break
      }
    }
    if (!matched) {
      for (const { keywords, category } of CATEGORY_MAP) {
        if (keywords.test(article.description)) {
          counts[category]++
          break
        }
      }
    }
  }

  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  // Default to 'Nasional' if no keyword matched any article
  return best && best[1] > 0 ? best[0] : 'Nasional'
}

/**
 * Find the latest publication date among a list of articles.
 * Returns epoch (1 Jan 1970) when no article has a valid published_at.
 */
function latestDate(articles: NormalizedItem[]): Date {
  let latest = new Date(0)
  for (const a of articles) {
    if (a.published_at && a.published_at > latest) {
      latest = a.published_at
    }
  }
  return latest
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Group articles into semantic clusters using greedy single-pass clustering.
 *
 * Algorithm:
 * 1. Iterate articles in order.
 * 2. For each unclustered article, start a new cluster with it as the seed.
 * 3. Scan remaining unclustered articles; add any whose cosine similarity to
 *    the seed embedding is ≥ CLUSTER_THRESHOLD to the same cluster.
 *
 * Precondition: `articles.length === embeddings.length`.
 *
 * @param articles   - Normalised (and deduplicated) article items
 * @param embeddings - Embedding vectors in the same order as `articles`
 * @returns Array of `ClusterResult` objects, one per cluster
 *
 * Requirements: 8.6
 */
export function cluster(
  articles: NormalizedItem[],
  embeddings: number[][],
): ClusterResult[] {
  if (articles.length !== embeddings.length) {
    throw new Error(
      `cluster: articles.length (${articles.length}) !== embeddings.length (${embeddings.length})`,
    )
  }

  const assigned = new Set<number>()
  const clusters: ClusterResult[] = []

  for (let seed = 0; seed < articles.length; seed++) {
    if (assigned.has(seed)) continue

    const members: NormalizedItem[] = [articles[seed]]
    assigned.add(seed)

    for (let candidate = seed + 1; candidate < articles.length; candidate++) {
      if (assigned.has(candidate)) continue

      const sim = cosineSimilarity(embeddings[seed], embeddings[candidate])
      if (sim >= CLUSTER_THRESHOLD) {
        members.push(articles[candidate])
        assigned.add(candidate)
      }
    }

    const uniqueSources = [...new Set(members.map((a) => a.source).filter(Boolean))]

    clusters.push({
      articles: members,
      uniqueSources,
      latestPublishedAt: latestDate(members),
      primaryCategory: inferCategory(members),
    })
  }

  return clusters
}
