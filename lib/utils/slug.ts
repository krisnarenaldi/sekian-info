/**
 * Slug utility functions for generation and validation.
 *
 * Requirements: 13.3
 */

const SLUG_REGEX = /^[a-z0-9-]{1,200}$/

/**
 * Generate a URL-friendly slug from a given string.
 *
 * Converts to lowercase, removes non-alphanumeric characters, replaces spaces with hyphens,
 * and collapses multiple consecutive hyphens.
 */
export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 200)
}

/**
 * Validate that a slug matches our allowed pattern:
 * - Only lowercase letters, numbers, and hyphens
 * - 1-200 characters long
 */
export function validateSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug)
}
