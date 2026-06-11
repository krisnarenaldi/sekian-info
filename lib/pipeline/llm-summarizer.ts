/**
 * LLM Summarizer — LiteLLM (OpenAI-compatible) wrapper untuk semua pipeline digest.
 *
 * Exported functions:
 *   - summarizeNews(clusters: ScoredCluster[])        → NewsDigestItem[]
 *   - summarizeMarket(marketData: MarketData)          → string  (insight text)
 *   - summarizeAINews(newsItems: NormalizedItem[])     → AINewsItem[]
 *   - summarizeArticle(content, title)                 → ArticleSummary
 *
 * Semua fungsi parse output JSON dan melempar error jika respons bukan JSON valid.
 * Setiap pemanggilan LLM yang gagal dicatat via structured logger.
 *
 * Requirements: 8.9, 9.4, 10.3, 11.3, 14.2
 */

import OpenAI from 'openai'
import { createLogger } from '../utils/logger'
import type { ScoredCluster } from './scorer'
import type { NormalizedItem } from './normalizer'

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/**
 * A single news digest item produced by summarizeNews.
 */
export interface NewsDigestItem {
  title: string
  summary: string
  category: string
  source: string
  source_url: string
}

/**
 * Market insight wrapper — insight berisi teks analisis pasar modal.
 */
export interface MarketInsight {
  insight: string
}

/**
 * A single AI news item with developer impact produced by summarizeAINews.
 */
export interface AINewsItem {
  title: string
  summary: string
  impact: string
  source: string
  link: string
}

/**
 * On-demand article summary with key bullet points.
 */
export interface ArticleSummary {
  summary: string
  key_points: string[]
}

/**
 * Input shape for summarizeMarket — data pasar keuangan harian.
 * Semua field opsional untuk mengakomodasi API yang sebagian gagal.
 */
export interface MarketData {
  ihsg?: number | null
  ihsg_change?: number | null
  usd_idr?: number | null
  gold_price?: number | null
  top_gainer?: Array<{ code: string; name: string; change_pct: number }> | null
  top_loser?: Array<{ code: string; name: string; change_pct: number }> | null
}

// ---------------------------------------------------------------------------
// Lazy-initialized LiteLLM client
// ---------------------------------------------------------------------------

const LLM_MODEL = 'gpt-3.5-turbo'

/**
 * Mendapatkan instance OpenAI client secara lazy.
 * Inisialisasi ditunda sampai benar-benar dibutuhkan (runtime, bukan saat build)
 * agar environment variable LLMLITE_KEY tidak diperlukan saat build.
 */
let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.LLMLITE_KEY!,
      baseURL: 'http://litellm.koboi2026.biz.id/v1',
    })
  }
  return _client
}

/**
 * Thin wrapper so call-sites stay identical — sends a single user message
 * and returns the response text.
 */
async function generateContent(prompt: string): Promise<string> {
  const completion = await getClient().chat.completions.create({
    model: LLM_MODEL,
    messages: [{ role: 'user', content: prompt }],
  })
  return completion.choices[0]?.message?.content ?? ''
}

const log = createLogger('llm-summarizer')

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Retry config for transient Gemini errors (503 overload, 429 rate-limit).
 */
const RETRY_MAX_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 2_000  // 2s → 4s → 8s

/**
 * Returns true if the error looks like a transient Gemini server error
 * that is worth retrying (503 Service Unavailable or 429 Too Many Requests).
 */
function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    return /\[503/.test(err.message) || /\[429/.test(err.message)
  }
  return false
}

/**
 * Sleep for `ms` milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Call `fn` with exponential backoff, retrying only on transient errors.
 *
 * Attempts: 1 (immediate) + up to RETRY_MAX_ATTEMPTS - 1 retries.
 * Delays:   RETRY_BASE_DELAY_MS × 2^attempt (2s, 4s, 8s by default).
 *
 * Throws the last error if all attempts are exhausted.
 */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isRetryableError(err) || attempt === RETRY_MAX_ATTEMPTS - 1) {
        throw err
      }
      const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
      log.warn(
        `${label}: transient error on attempt ${attempt + 1}/${RETRY_MAX_ATTEMPTS}, ` +
        `retrying in ${delayMs}ms — ${err instanceof Error ? err.message : String(err)}`
      )
      await sleep(delayMs)
    }
  }
  throw lastErr
}

/**
 * Strip markdown code fences (```json ... ``` atau ``` ... ```) yang mungkin
 * dibungkus model di sekeliling output JSON-nya, lalu parse dan kembalikan
 * hasil bertipe T.
 *
 * Melempar `Error('Invalid JSON response from LLM')` jika parse gagal.
 */
function parseJSON<T>(text: string): T {
  // Hapus optional ```json atau ``` fences
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  try {
    return JSON.parse(stripped) as T
  } catch {
    throw new Error('Invalid JSON response from LLM')
  }
}

// ---------------------------------------------------------------------------
// Public summarization functions
// ---------------------------------------------------------------------------

/**
 * Hasilkan nama topik (maksimal 4 kata) untuk satu cluster artikel.
 *
 * Prompt: daftar judul artikel dalam cluster → LLM → nama topik singkat.
 *
 * Requirement 8.9
 */
export async function nameCluster(cluster: ScoredCluster): Promise<string> {
  const articleList = cluster.articles
    .slice(0, 5)
    .map((a, i) => `${i + 1}. ${a.title}`)
    .join('\n')

  const prompt = `Cluster Articles:\n${articleList}\n\nBerikan nama topik maksimal 4 kata.`

  try {
    const text = await withRetry(() => generateContent(prompt), 'nameCluster')
    return text.trim().replace(/^["']|["']$/g, '')
  } catch (err) {
    log.error('LLM call failed in nameCluster', err)
    // Fallback ke kategori cluster jika LLM gagal
    return cluster.primaryCategory
  }
}

/**
 * Ambil top 5 cluster dan kembalikan item digest terstruktur dengan nama
 * cluster dari LLM, ringkasan singkat, kategori, sumber, dan slug.
 *
 * Input harus sudah berupa 5 cluster teratas (sudah di-sort & slice di cron).
 *
 * Requirement 8.9
 */
export async function summarizeNews(
  clusters: ScoredCluster[],
): Promise<NewsDigestItem[]> {
  // Nama cluster dihasilkan paralel untuk efisiensi
  const clusterNames = await Promise.all(clusters.map((c) => nameCluster(c)))

  // Kirim semua cluster sekaligus ke LLM untuk ringkasan
  const clustersWithNames = clusters.map((c, i) => ({
    cluster_name: clusterNames[i],
    category: c.primaryCategory,
    articles: c.articles.slice(0, 5).map((a) => ({
      title: a.title,
      source: a.source,
      source_url: a.link,
    })),
  }))

  const prompt = `Kamu adalah editor berita senior untuk masyarakat Indonesia.

Berikut adalah ${clusters.length} topik berita Indonesia hari ini:
${JSON.stringify(clustersWithNames, null, 2)}

Tugasmu:
Untuk setiap topik, buat:
1. Ringkasan maksimal 1 kalimat (maksimal 150 karakter) menjelaskan inti berita.
2. Tentukan kategori: "Nasional", "Ekonomi", atau "Politik".
3. Pilih 1 artikel representatif untuk sumber dan source_url.

Output JSON array dengan tepat ${clusters.length} item, urutan sama dengan input:
[
  {
    "title": "nama topik cluster (gunakan cluster_name dari input)",
    "summary": "ringkasan 1 kalimat",
    "category": "Nasional|Ekonomi|Politik",
    "source": "nama sumber artikel representatif",
    "source_url": "url artikel representatif"
  }
]

Output HANYA JSON array, tanpa penjelasan tambahan.`

  try {
    const text = await withRetry(() => generateContent(prompt), 'summarizeNews')
    const items = parseJSON<NewsDigestItem[]>(text)

    // Pastikan jumlah item sesuai; fallback ke cluster_name jika LLM mengembalikan lebih/kurang
    return clusters.map((c, i) => {
      const item = items[i]
      if (item) return item
      // Fallback minimal jika LLM tidak mengembalikan item untuk index ini
      const rep = c.articles[0]
      return {
        title: clusterNames[i],
        summary: rep?.title ?? clusterNames[i],
        category: c.primaryCategory,
        source: rep?.source ?? '',
        source_url: rep?.link ?? '',
      }
    })
  } catch (err) {
    log.error('LLM call failed in summarizeNews', err)
    throw err
  }
}

/**
 * Hasilkan insight pasar singkat dari snapshot data pasar hari ini.
 *
 * Menggunakan prompt template "Pasar Hari Ini".
 * Mengembalikan teks insight polos (maks 2 kalimat) — bukan objek wrapper.
 *
 * Requirement 9.4
 */
export async function summarizeMarket(marketData: MarketData): Promise<string> {
  const topGainerStr = marketData.top_gainer
    ? marketData.top_gainer
        .map((s) => `${s.code} (${s.name}) +${s.change_pct}%`)
        .join(', ')
    : 'N/A'

  const topLoserStr = marketData.top_loser
    ? marketData.top_loser
        .map((s) => `${s.code} (${s.name}) ${s.change_pct}%`)
        .join(', ')
    : 'N/A'

  const prompt = `Kamu adalah analis pasar modal Indonesia.

Data pasar hari ini:
- IHSG: ${marketData.ihsg ?? 'N/A'} (${marketData.ihsg_change ?? 'N/A'}%)
- USD/IDR: Rp ${marketData.usd_idr ?? 'N/A'}
- Harga Emas: Rp ${marketData.gold_price ?? 'N/A'}/gram
- Top Gainer: ${topGainerStr}
- Top Loser: ${topLoserStr}

Buat insight pasar hari ini dalam maksimal 2 kalimat. Fokus pada faktor penggerak utama dan dampaknya.

Output HANYA teks insight, tanpa judul atau label.`

  try {
    return (await withRetry(() => generateContent(prompt), 'summarizeMarket')).trim()
  } catch (err) {
    log.error('LLM call failed in summarizeMarket', err)
    throw err
  }
}

/**
 * Rangkum item berita AI, pilih 3–5 yang paling penting dan jelaskan
 * dampaknya bagi developer Indonesia.
 *
 * Menggunakan prompt template "AI Hari Ini".
 *
 * Requirement 10.3
 */
export async function summarizeAINews(
  newsItems: NormalizedItem[],
): Promise<AINewsItem[]> {
  const prompt = `Kamu adalah technology writer yang menulis untuk developer Indonesia.

Berikut berita terbaru dari OpenAI, Anthropic, Google AI, Meta AI, dan HuggingFace:
${JSON.stringify(newsItems, null, 2)}

Tugasmu:
1. Pilih 3 hingga 5 berita AI yang paling penting dan relevan.
2. Untuk setiap berita, jelaskan dampaknya bagi developer Indonesia dalam maksimal 3 kalimat.

Output JSON array dengan format:
[
  {
    "title": "judul berita",
    "summary": "ringkasan singkat",
    "impact": "penjelasan dampak untuk developer Indonesia (max 3 kalimat)",
    "source": "nama organisasi (OpenAI/Anthropic/dll)",
    "link": "url berita asli"
  }
]

Output HANYA JSON array, tanpa penjelasan tambahan.`

  try {
    const text = await withRetry(() => generateContent(prompt), 'summarizeAINews')
    return parseJSON<AINewsItem[]>(text)
  } catch (err) {
    log.error('LLM call failed in summarizeAINews', err)
    throw err
  }
}

/**
 * Rangkum artikel on-demand menjadi respons terstruktur dengan ringkasan
 * komprehensif dan poin-poin penting.
 *
 * Menggunakan prompt template "On-Demand Article Summary".
 *
 * Requirements 11.3, 14.2
 */
export async function summarizeArticle(
  content: string,
  title: string,
): Promise<ArticleSummary> {
  const prompt = `Kamu adalah editor yang membantu pembaca memahami artikel berita dengan cepat.

Berikut adalah konten artikel:
Judul: ${title}
---
${content}
---

Tugasmu:
1. Buat ringkasan komprehensif artikel ini dalam 2-3 paragraf.
2. Ekstrak 3-5 poin penting dari artikel.

Output JSON dengan format:
{
  "summary": "ringkasan 2-3 paragraf",
  "key_points": ["poin 1", "poin 2", "poin 3"]
}

Output HANYA JSON, tanpa penjelasan tambahan.`

  try {
    const text = await withRetry(() => generateContent(prompt), 'summarizeArticle')
    return parseJSON<ArticleSummary>(text)
  } catch (err) {
    log.error('LLM call failed in summarizeArticle', err)
    throw err
  }
}