/**
 * Normalizer — mengubah item mentah RSS menjadi bentuk yang seragam.
 *
 * Setiap item yang tidak memiliki `title` valid atau `link` yang dapat
 * diurai sebagai URL akan ditolak (dikembalikan sebagai `null`).
 *
 * Output shape: { title, description, source, link, published_at }
 *
 * Requirements: 8.3, 13.1
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface NormalizedItem {
  title: string
  description: string
  source: string
  link: string
  published_at: Date
  /** Optional image URL extracted from RSS enclosure/media:content. */
  image?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Panjang maksimal deskripsi yang disimpan. */
const DESCRIPTION_MAX_LENGTH = 500

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Periksa apakah sebuah string merupakan URL yang valid.
 * Menggunakan `new URL()` yang akan melempar jika string bukan URL valid.
 */
function isValidUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

/**
 * Baca properti string dari objek unknown dengan aman.
 * Mengembalikan undefined jika objek bukan object, properti tidak ada,
 * atau nilainya bukan string.
 */
function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const val = obj[key]
  return typeof val === 'string' ? val : undefined
}

/**
 * Ekstrak deskripsi dari item dengan urutan prioritas:
 * contentSnippet → content → description → string kosong
 * Dipotong pada DESCRIPTION_MAX_LENGTH karakter.
 */
function extractDescription(raw: Record<string, unknown>): string {
  const text =
    getString(raw, 'contentSnippet') ??
    getString(raw, 'content') ??
    getString(raw, 'description') ??
    ''
  return text.slice(0, DESCRIPTION_MAX_LENGTH)
}

/**
 * Ekstrak tanggal publikasi dari item dengan urutan prioritas:
 * isoDate → pubDate → new Date() jika tidak ditemukan atau tidak valid.
 * Mengembalikan objek Date.
 */
function extractPublishedAt(raw: Record<string, unknown>): Date {
  const isoDate = getString(raw, 'isoDate')
  if (isoDate) {
    const d = new Date(isoDate)
    if (!isNaN(d.getTime())) return d
  }

  const pubDate = getString(raw, 'pubDate')
  if (pubDate) {
    const d = new Date(pubDate)
    if (!isNaN(d.getTime())) return d
  }

  return new Date()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalisasi satu item mentah (unknown) menjadi `NormalizedItem`.
 *
 * Field `source` dibaca dari properti `source` pada item mentah itu sendiri
 * (diisi oleh RSS_Fetcher saat fetch). Jika tidak ada, default ke string kosong.
 *
 * Mengembalikan `null` jika:
 * - Input bukan object atau null
 * - `title` tidak ada atau kosong setelah di-trim
 * - `link` tidak ada atau bukan URL yang valid
 *
 * Requirements: 8.3, 13.1
 *
 * @param rawItem - Item mentah dari sumber apa pun (unknown)
 * @returns `NormalizedItem` yang sudah dinormalisasi, atau `null` jika tidak valid
 */
export function normalizeItem(rawItem: unknown): NormalizedItem | null {
  // Pastikan rawItem adalah plain object yang dapat diinspeksi
  if (typeof rawItem !== 'object' || rawItem === null || Array.isArray(rawItem)) {
    return null
  }

  const raw = rawItem as Record<string, unknown>

  // Validasi title
  const title = (getString(raw, 'title') ?? '').trim()
  if (!title) return null

  // Validasi link
  const link = (getString(raw, 'link') ?? '').trim()
  if (!link || !isValidUrl(link)) return null

  // source diambil dari item itu sendiri (diisi oleh RSS_Fetcher)
  const source = (getString(raw, 'source') ?? '').trim()
  const image = getString(raw, 'image')

  return {
    title,
    description: extractDescription(raw),
    source,
    link,
    published_at: extractPublishedAt(raw),
    image,
  }
}

/**
 * Normalisasi array item unknown, memfilter item yang tidak valid.
 *
 * Requirements: 8.3, 13.1
 *
 * @param items - Array item mentah dari sumber apa pun
 * @returns Array `NormalizedItem` yang hanya berisi item valid
 */
export function normalizeAll(items: unknown[]): NormalizedItem[] {
  return items.reduce<NormalizedItem[]>((acc, rawItem) => {
    const normalized = normalizeItem(rawItem)
    if (normalized !== null) acc.push(normalized)
    return acc
  }, [])
}
