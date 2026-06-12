/**
 * Halaman Daftar Berita — /news
 *
 * Menampilkan berita dari tanggal terbaru di daily_digest.
 * Mendukung filter feed_type via query parameter: ?feed_type=sport | ?feed_type=international
 * Default: menampilkan berita Indonesia (feed_type = "indonesia").
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getLatestDailyDigestByType, type FeedType } from '@/lib/supabase/queries/daily-digest'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import NewsItem from '../components/shared/NewsItem'

// Revalidate setiap 15 menit, selaras dengan cache fetcher
export const revalidate = 900

type Props = {
  searchParams: Promise<{ feed_type?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const resolvedParams = await searchParams
  const feedType = resolvedParams?.feed_type || 'indonesia'

  const metaMap: Record<string, { title: string; description: string }> = {
    indonesia: {
      title: 'Berita Indonesia Hari Ini — Sekian Info',
      description: 'Kumpulan ringkasan berita Indonesia terkini.',
    },
    sport: {
      title: 'Berita Olahraga Hari Ini — Sekian Info',
      description: 'Kumpulan ringkasan berita olahraga terkini.',
    },
    international: {
      title: 'Berita Internasional Hari Ini — Sekian Info',
      description: 'Kumpulan ringkasan berita internasional terkini.',
    },
    market: {
      title: 'Berita Pasar/Investasi Hari Ini — Sekian Info',
      description: 'Kumpulan ringkasan berita pasar dan investasi terkini.',
    },
  }

  const meta = metaMap[feedType] ?? metaMap.indonesia

  return {
    title: meta.title,
    description: meta.description,
  }
}

export default async function NewsPage({ searchParams }: Props) {
  const resolvedParams = await searchParams
  const feedType: FeedType = (resolvedParams?.feed_type as FeedType) || 'indonesia'

  const items = await getLatestDailyDigestByType(feedType)

  if (!items || items.length === 0) {
    notFound()
  }

  // Format tanggal yang mudah dibaca
  const dateLabel = new Date(items[0].date + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const headerMap: Record<string, { emoji: string; label: string }> = {
    indonesia: { emoji: '🇮🇩', label: 'Indonesia Info' },
    sport: { emoji: '⚽', label: 'Sport Info' },
    international: { emoji: '🌍', label: 'Internasional Info' },
    market: { emoji: '💼', label: 'Investasi Info' },
  }

  const header = headerMap[feedType] ?? headerMap.indonesia

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-gray-900">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            href="/"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            ← Kembali ke Beranda
          </Link>
        </nav>

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span aria-hidden="true">{header.emoji}</span> {header.label}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{dateLabel}</p>
        </div>

        {/* News list */}
        <section
          aria-label={`Daftar lengkap ${header.label.toLowerCase()} hari ini`}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
        >
          <ul className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {items.map((item) => {
              const sources: string[] =
                Array.isArray(item.raw_json?.cluster_sources) &&
                (item.raw_json.cluster_sources as { name: string; url: string }[]).length > 0
                  ? (item.raw_json.cluster_sources as { name: string; url: string }[]).map((s) => s.name)
                  : item.source
                    ? [item.source]
                    : []

              return (
                <li key={item.id}>
                  <NewsItem
                    title={item.title}
                    summary={item.summary}
                    slug={item.slug}
                    source={item.source}
                    category={item.category ?? undefined}
                    sources={sources}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      </main>

      <Footer />
    </div>
  )
}