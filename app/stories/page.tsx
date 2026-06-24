import type { Metadata } from 'next'
import Link from 'next/link'
import { getStoriesForListing, type StoryStatus } from '@/lib/supabase/queries/stories'
import Header from '@/app/components/layout/Header'
import Footer from '@/app/components/layout/Footer'

export const metadata: Metadata = {
  title: 'Semua Topik Berita — Sekian Info',
  description: 'Direktori semua topik berita yang sedang dilacak dan berkembang di Sekian Info.',
}

export const revalidate = 900

const RESOLVED_LIMIT = 10

function formatDateIndo(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  const monthsShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des',
  ]
  return `${parseInt(day, 10)} ${monthsShort[parseInt(month, 10) - 1]}`
}

const STATUS_BADGE: Record<StoryStatus, { label: string; className: string }> = {
  NEW: {
    label: 'Baru',
    className: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  ACTIVE: {
    label: 'Aktif',
    className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  RESOLVED: {
    label: 'Selesai',
    className: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  },
}

type StoryRowProps = {
  id: string
  title: string
  status: StoryStatus
  snapshot_count: number
  article_count: number
  source_count: number
  first_seen_at: string
  last_seen_at: string
  dimmed?: boolean
}

function StoryRow({
  id, title, status, snapshot_count, article_count, source_count,
  first_seen_at, last_seen_at, dimmed = false,
}: StoryRowProps) {
  const badge = STATUS_BADGE[status]
  return (
    <li role="listitem">
      <Link
        href={`/stories/${id}`}
        className={`flex items-start justify-between gap-4 bg-white dark:bg-gray-800 rounded-xl px-5 py-4 shadow-sm border border-gray-100 dark:border-gray-700 group transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          dimmed
            ? 'opacity-70 hover:opacity-100 hover:border-gray-300 dark:hover:border-gray-500'
            : 'hover:border-blue-300 dark:hover:border-blue-600'
        }`}
      >
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium leading-snug line-clamp-2 transition-colors ${
            dimmed
              ? 'text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200'
              : 'text-gray-800 dark:text-gray-100 font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400'
          }`}>
            {title}
          </span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-400 dark:text-gray-500">
            <span>📅 {formatDateIndo(first_seen_at)} – {formatDateIndo(last_seen_at)}</span>
            <span>•</span>
            <span>📄 {article_count} artikel</span>
            <span>•</span>
            <span>🌐 {source_count} media</span>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badge.className}`}>
            {badge.label}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap ${
            dimmed
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
          }`}>
            {snapshot_count} hari
          </span>
        </div>
      </Link>
    </li>
  )
}

export default async function StoriesPage() {
  let active: Awaited<ReturnType<typeof getStoriesForListing>>['active'] = []
  let resolved: Awaited<ReturnType<typeof getStoriesForListing>>['resolved'] = []
  let resolvedTotal = 0
  let fetchError = false

  try {
    const result = await getStoriesForListing(RESOLVED_LIMIT)
    active = result.active
    resolved = result.resolved
    resolvedTotal = result.resolvedTotal
  } catch {
    fetchError = true
  }

  const resolvedHidden = Math.max(0, resolvedTotal - resolved.length)

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-gray-900">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <Link
            href="/"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            ← Kembali ke Beranda
          </Link>
        </nav>

        {/* Page Header */}
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            📈 Semua Topik Berita
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Topik yang sedang dilacak dan berkembang dari hari ke hari.
          </p>
        </header>

        {fetchError ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center text-sm text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-700">
            Gagal memuat data. Silakan coba lagi nanti.
          </div>
        ) : active.length === 0 && resolved.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center text-sm text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-700">
            Belum ada topik yang tercatat.
          </div>
        ) : (
          <div className="space-y-10">
            {/* Sedang Berkembang */}
            {active.length > 0 && (
              <section aria-labelledby="active-heading">
                <h2 id="active-heading" className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                  Sedang Berkembang ({active.length})
                </h2>
                <ul className="space-y-3" role="list">
                  {active.map((story) => (
                    <StoryRow key={story.id} {...story} />
                  ))}
                </ul>
              </section>
            )}

            {/* Sudah Selesai */}
            {resolved.length > 0 && (
              <section aria-labelledby="resolved-heading">
                <h2 id="resolved-heading" className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                  Sudah Selesai ({resolvedTotal})
                </h2>
                <ul className="space-y-3" role="list">
                  {resolved.map((story) => (
                    <StoryRow key={story.id} {...story} dimmed />
                  ))}
                </ul>

                {resolvedHidden > 0 && (
                  <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 text-center">
                    dan {resolvedHidden} topik lainnya yang sudah selesai.
                  </p>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
