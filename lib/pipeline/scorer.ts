/**
 * Scorer — computes importance scores for news clusters and selects the top 20.
 *
 * Score formula (all weights sum to 1.0):
 *   score = 0.40 × sourceScore + 0.40 × freshnessScore + 0.20 × categoryScore
 *
 * - sourceScore:    uniqueSources.length / MAX_SOURCES (capped at 1.0)
 * - freshnessScore: linear decay over 24 h; 0 if age > 24 h
 * - categoryScore:  Nasional=1.0, Ekonomi=0.8, Politik=0.6, Other=0.3
 *
 * Requirements: 8.7, 8.8
 */

import type { ClusterResult } from './clusterer'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Assumed maximum number of sources for normalising sourceScore. */
const MAX_SOURCES = 5

/** Freshness decay window in milliseconds (24 hours). */
const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000

/** Number of top clusters to return from `scoreAll`. */
const TOP_N = 20

/** Category weight lookup. */
const CATEGORY_WEIGHT: Record<string, number> = {
  Nasional: 1.0,
  Ekonomi: 0.8,
  Politik: 0.6,
}

const DEFAULT_CATEGORY_WEIGHT = 0.3

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScoredCluster extends ClusterResult {
  score: number
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the importance score of a single cluster.
 *
 * The score is always in [0.0, 1.0]:
 * - sourceScore is capped at 1.0 (in case uniqueSources.length > MAX_SOURCES)
 * - freshnessScore is 0.0 when age > 24 h
 * - categoryScore defaults to DEFAULT_CATEGORY_WEIGHT for unknown categories
 *
 * @param cluster - A `ClusterResult` as returned by `cluster()`
 * @param now     - Reference time for freshness calculation (default: Date.now())
 * @returns Score in the range [0.0, 1.0]
 *
 * Requirements: 8.7
 */
export function scoreCluster(cluster: ClusterResult, now: Date = new Date()): number {
  // --- sourceScore ---
  const sourceScore = Math.min(cluster.uniqueSources.length / MAX_SOURCES, 1.0)

  // --- freshnessScore ---
  const ageMs = now.getTime() - cluster.latestPublishedAt.getTime()
  const freshnessScore = ageMs >= FRESHNESS_WINDOW_MS
    ? 0
    : Math.max(0, 1 - ageMs / FRESHNESS_WINDOW_MS)

  // --- categoryScore ---
  const categoryScore =
    CATEGORY_WEIGHT[cluster.primaryCategory] ?? DEFAULT_CATEGORY_WEIGHT

  return 0.4 * sourceScore + 0.4 * freshnessScore + 0.2 * categoryScore
}

/**
 * Score all clusters and return the top `n` by score, sorted descending.
 *
 * @param clusters - Array of `ClusterResult` objects from the clusterer
 * @param n        - Number of top clusters to return (default: 20)
 * @param now      - Reference time for freshness calculation (default: Date.now())
 * @returns Up to `n` `ScoredCluster` objects sorted by score descending
 *
 * Requirements: 8.8
 */
export function scoreAll(
  clusters: ClusterResult[],
  n = TOP_N,
  now: Date = new Date(),
): ScoredCluster[] {
  return clusters
    .map((c) => ({ ...c, score: scoreCluster(c, now) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
}
