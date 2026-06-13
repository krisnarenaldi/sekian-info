/**
 * Halaman Detail Artikel — /news/[slug]
 *
 * Menampilkan ringkasan AI artikel on-demand dengan:
 * - Validasi slug: notFound() jika tidak cocok regex
 * - <Suspense> + loading skeleton saat on-demand generation berlangsung
 * - Ringkasan AI, poin-poin penting, daftar sumber link terkait topik
 * - Pesan error + daftar sumber link jika summary tidak tersedia
 * - Right sidebar with other news from all feed types (retention)
 *
 * Requirements: 7.1, 7.4, 7.5, 13.3
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { validateSlug } from '@/lib/utils/slug'
import { getDailyDigestBySlug } from '@/lib/supabase/queries/daily-digest'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import CardSkeleton from '../../components/shared/CardSkeleton'
import OtherNewsSidebar from '../../components/cards/OtherNewsSidebar'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClusterSourceEntry {
  name: string
  url: string
  title?: string
}

interface ArticleData {
  title: string
  summary: string | null
  key_points: string[] | null
  source_url: string
  source_name: string | null
  cluster_sources: ClusterSourceEntry[]
  error?: string
}

// ─── Loading Fallback ─────────────────────────────────────────────────────────

function ArticleLoadingFallback() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      {/* Back link placeholder */}
      <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 space-y-6">
        {/* Title skeleton */}
        <div className="space-y-3">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse" />
        </div>

        {/* Loading indicator with accessible label */}
        <CardSkeleton label="Sedang membuat ringkasan artikel, harap tunggu..." />
        <CardSkeleton label="Memuat poin-poin penting..." />

        {/* Button placeholder */}
        <div className="h-12 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    </div>
  )
}

// ─── Article Detail Content (async — triggers on-demand generation) ───────────

async function ArticleDetail({ slug }: { slug: string }) {
  // Call /api/news/[slug] — handles cache check & on-demand generation
  let data: ArticleData

  try {
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = headersList.get('x-forwarded-proto') || 'http'
    const baseUrl = `${protocol}://${host}`

    const res = await fetch(`${baseUrl}/api/news/${encodeURIComponent(slug)}`, {
      // No cache — always fetch fresh so on-demand generation always runs
      cache: 'no-store',
    })

    if (res.status === 404) {
      notFound()
    }

    if (!res.ok && res.status !== 200) {
      throw new Error(`API responded with ${res.status}`)
    }

    data = await res.json()
  } catch (err) {
    // Unexpected error — show generic error state
    data = {
      title: 'Artikel tidak dapat dimuat',
      summary: null,
      key_points: null,
      source_url: '#',
      source_name: null,
      cluster_sources: [],
      error: 'Ringkasan tidak tersedia',
    }
  }

  const hasError = !!data.error || !data.summary
  const sources = data.cluster_sources?.filter((s) => s.url) ?? []

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Link
        href="/"
        className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
      >
        &larr; Kembali ke Beranda
      </Link>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
        {/* Article — left column */}
        <article
          className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8"
          aria-labelledby="article-title"
        >
          {/* Judul & Sumber */}
          <header className="mb-6">
            <h1
              id="article-title"
              className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2 leading-tight"
            >
              {data.title}
            </h1>
            {data.source_name && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Sumber:{' '}
                <span className="font-medium text-gray-600 dark:text-gray-300">{data.source_name}</span>
              </p>
            )}
          </header>

          {/* Konten ringkasan atau error state */}
          {hasError ? (
            /* Error state — Requirement 7.4 */
            <div
              role="alert"
              aria-live="polite"
              className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg mb-6"
            >
              <p className="text-yellow-800 dark:text-yellow-200 font-medium">Ringkasan tidak tersedia</p>
              <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                Silakan baca salah satu artikel asli di bawah untuk informasi lengkapnya.
              </p>
              <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-2">
                Maaf, silakan coba lagi. Jika masalah berlanjut, hubungi tim teknis.
              </p>
            </div>
          ) : (
            <>
              {/* Ringkasan AI — Requirement 7.1 */}
              <section aria-labelledby="summary-heading" className="mb-6">
                <h2
                  id="summary-heading"
                  className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3"
                >
                  Ringkasan
                </h2>
                <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                  {data.summary}
                </div>
              </section>

              {/* Poin-poin penting — Requirement 7.1 */}
              {data.key_points && data.key_points.length > 0 && (
                <section aria-labelledby="key-points-heading" className="mb-6">
                  <h2
                    id="key-points-heading"
                    className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3"
                  >
                    Poin Penting
                  </h2>
                  <ul
                    className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300"
                    aria-label="Poin-poin penting artikel"
                  >
                    {data.key_points.map((point, idx) => (
                      <li key={idx}>{point}</li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {/* Daftar sumber link terkait topik */}
          {sources.length > 0 && (
            <section aria-labelledby="sources-heading" className="mb-6">
              <h2
                id="sources-heading"
                className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3"
              >
                Sumber Terkait
              </h2>
              <ul className="space-y-3">
                {sources.map((source, idx) => {
                  let domain = ''
                  try {
                    domain = new URL(source.url).hostname.replace(/^www\./, '')
                  } catch {
                    domain = source.url
                  }
                  return (
                    <li key={idx}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col gap-1 px-4 py-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        aria-label={`Baca artikel dari ${source.name}: ${source.title || source.url}`}
                      >
                        {source.title && (
                          <span className="text-sm font-medium leading-snug line-clamp-2">{source.title}</span>
                        )}
                        <span className="text-xs text-blue-500/70 dark:text-blue-400/60">
                          {source.name}
                          {domain && <span> — {domain}</span>}
                        </span>
                      </a>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* Fallback tombol tunggal jika tidak ada cluster_sources */}
          {sources.length === 0 && data.source_url && data.source_url !== '#' && (
            <a
              href={data.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium"
              aria-label={`Baca artikel asli: ${data.title}`}
            >
              Baca Artikel Asli →
            </a>
          )}
        </article>

        {/* Sidebar — right column */}
        <div className="mt-6 lg:mt-0">
          <OtherNewsSidebar currentSlug={slug} />
        </div>
      </div>
    </div>
  )
}

// ─── Page Component ────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ slug: string }>
}

/**
 * Generate dynamic metadata so the browser tab shows the article title.
 * Falls back to a generic title if the slug is invalid or the article is not found.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params

  if (!validateSlug(slug)) {
    return { title: 'Artikel tidak ditemukan — Sekian Info' }
  }

  try {
    const digestItem = await getDailyDigestBySlug(slug)
    if (digestItem) {
      return {
        title: `${digestItem.title} — Sekian Info`,
        description: digestItem.summary,
      }
    }
  } catch {
    // Silently fall through to the default title
  }

  return { title: 'Detail Artikel — Sekian Info' }
}

export default async function NewsDetailPage({ params }: Props) {
  const { slug } = await params

  // Task 12.2: Validate slug — return 404 for invalid slugs
  // Requirement 7.1, 13.3
  if (!validateSlug(slug)) {
    notFound()
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-gray-900">
      <Header />
      <main className="flex-1">
        {/*
          <Suspense> wraps ArticleDetail so Next.js streams the loading fallback
          immediately, then replaces it with the full content once the async
          on-demand generation completes — Requirement 7.5
        */}
        <Suspense fallback={<ArticleLoadingFallback />}>
          <ArticleDetail slug={slug} />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}