/**
 * Math utility for cosine similarity calculation.
 * Used by the Deduplicator pipeline to detect semantically similar articles.
 */

/**
 * Computes the dot product of two numeric vectors.
 *
 * @param vecA - First vector
 * @param vecB - Second vector (must have same length as vecA)
 * @returns The dot product value
 * @throws {Error} If vectors have different lengths
 */
export function dotProduct(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error(
      `Vector length mismatch: vecA.length=${vecA.length}, vecB.length=${vecB.length}`
    );
  }

  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    sum += vecA[i] * vecB[i];
  }
  return sum;
}

/**
 * Computes the Euclidean magnitude (L2 norm) of a numeric vector.
 *
 * @param vec - Input vector
 * @returns The magnitude (≥ 0)
 */
export function magnitude(vec: number[]): number {
  let sumOfSquares = 0;
  for (let i = 0; i < vec.length; i++) {
    sumOfSquares += vec[i] * vec[i];
  }
  return Math.sqrt(sumOfSquares);
}

/**
 * Computes the cosine similarity between two numeric vectors.
 *
 * Cosine similarity measures the cosine of the angle between two vectors,
 * returning a value in [0.0, 1.0] for non-negative vectors and [-1.0, 1.0]
 * in general. For embedding vectors (which can have negative components),
 * the result may be negative.
 *
 * Input validation:
 * - Throws if either vector has zero length (empty array)
 * - Returns 0 if either vector is a zero vector (all components are 0)
 * - Throws if vectors have different lengths
 *
 * @param vecA - First embedding vector (non-empty)
 * @param vecB - Second embedding vector (non-empty, same length as vecA)
 * @returns Cosine similarity in the range [-1.0, 1.0]; 0 if either is a zero vector
 * @throws {Error} If either vector is empty or vectors have different lengths
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length === 0) {
    throw new Error("vecA must not be empty (zero-length vector)");
  }
  if (vecB.length === 0) {
    throw new Error("vecB must not be empty (zero-length vector)");
  }
  if (vecA.length !== vecB.length) {
    throw new Error(
      `Vector length mismatch: vecA.length=${vecA.length}, vecB.length=${vecB.length}`
    );
  }

  const magA = magnitude(vecA);
  const magB = magnitude(vecB);

  // Return 0 if either vector is a zero vector to avoid division by zero
  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dotProduct(vecA, vecB) / (magA * magB);
}
