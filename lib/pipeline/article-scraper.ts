/**
 * Article scraper for fetching and extracting plain text from web pages.
 *
 * Fetches article HTML via streaming, enforces a size limit, then strips
 * markup to produce clean text suitable for downstream NLP / LLM processing.
 *
 * Requirements: 7.2, 13.2, 13.5
 */

import { createLogger } from '@/lib/utils/logger'

const log = createLogger('article-scraper')

// ---------------------------------------------------------------------------
// Custom error
// ---------------------------------------------------------------------------

export class ArticleSizeExceededError extends Error {
  constructor(url: string, maxBytes: number) {
    super(`Article at ${url} exceeds size limit of ${maxBytes} bytes`)
    this.name = 'ArticleSizeExceededError'
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch a web page and return its plain-text content.
 *
 * The response body is consumed as a stream so that pages larger than
 * `maxBytes` are rejected early without buffering the full payload.
 *
 * @param url      - Full URL of the article to scrape
 * @param maxBytes - Maximum number of bytes to read (default: 500 KB)
 * @returns        Plain text extracted from the article HTML
 *
 * @throws {ArticleSizeExceededError} when the response body exceeds `maxBytes`
 * @throws {Error}                    on network failure or null response body
 */
export async function scrapeArticle(
  url: string,
  maxBytes = 500 * 1024,
): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SekianInfoBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })

    if (response.body === null) {
      const nullBodyError = new Error(`Response body is null for URL: ${url}`)
      log.error('Response body is null', nullBodyError)
      throw nullBodyError
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let bytesRead = 0
    let html = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      bytesRead += value.byteLength

      if (bytesRead > maxBytes) {
        // Cancel the stream to free resources before throwing
        await reader.cancel()
        const sizeError = new ArticleSizeExceededError(url, maxBytes)
        log.error('Article size limit exceeded', sizeError)
        throw sizeError
      }

      html += decoder.decode(value, { stream: true })
    }

    // Flush any remaining bytes in the decoder
    html += decoder.decode()

    return extractText(html)
  } catch (err) {
    // Re-throw errors we already logged (ArticleSizeExceededError and null body)
    if (
      err instanceof ArticleSizeExceededError ||
      (err instanceof Error && err.message.startsWith('Response body is null'))
    ) {
      throw err
    }

    // Any other unexpected error (network failure, etc.)
    log.error('Failed to scrape article', err)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Strip HTML markup and decode common entities to produce plain text.
 */
function extractText(html: string): string {
  // Remove <script> ... </script> blocks (including content)
  let text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')

  // Remove <style> ... </style> blocks (including content)
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ')

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')

  // Collapse multiple whitespace/newlines into a single space, then trim
  text = text.replace(/\s+/g, ' ').trim()

  return text
}
