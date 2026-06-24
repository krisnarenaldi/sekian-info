import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getStoryById } from '@/lib/supabase/queries/stories'
import { getSnapshotsForStory } from '@/lib/supabase/queries/story-snapshots'
import Header from '@/app/components/layout/Header'
import Footer from '@/app/components/layout/Footer'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  try {
    const story = await getStoryById(id)
    if (story) {
      return {
        title: `${story.title} — Perkembangan Topik`,
        description: `Ikuti perkembangan dan linimasa berita mengenai ${story.title} di Sekian Info.`,
      }
    }
  } catch {
    // Silently fall through
  }
  return {
    title: 'Perkembangan Topik — Sekian Info',
  }
}

function formatDateIndo(dateStr: string): string {
  // Parsing date string (YYYY-MM-DD) manually to avoid timezone shift
  const [year, month, day] = dateStr.split('-')
  const monthsShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'
  ]
  const monthIdx = parseInt(month, 10) - 1
  return `${parseInt(day, 10)} ${monthsShort[monthIdx]}`
}

export default async function StoryDetailPage({ params }: Props) {
  const { id } = await params

  const [story, snapshots] = await Promise.all([
    getStoryById(id),
    getSnapshotsForStory(id),
  ])

  if (!story) {
    notFound()
  }

  // Sort chronological ascending (oldest first)
  const sortedSnapshots = [...snapshots].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  )

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-gray-900">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        {/* Navigation Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <Link
            href="/"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            ← Kembali ke Beranda
          </Link>
        </nav>

        {/* Story Header */}
        <header className="mb-8 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <span className="inline-block text-xs font-semibold px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full mb-3">
            Topik Berkembang ({story.snapshot_count} updates)
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
            Story: {story.title}
          </h1>
          <div className="flex gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
            <div>Pertama kali: <span className="font-medium">{formatDateIndo(story.first_seen_at)}</span></div>
            <div>Pembaruan terakhir: <span className="font-medium">{formatDateIndo(story.last_seen_at)}</span></div>
          </div>
        </header>

        {/* Timeline Container */}
        <section aria-label="Linimasa Perkembangan" className="relative pl-6 border-l-2 border-blue-500/30 dark:border-blue-500/20 ml-3 space-y-8">
          {sortedSnapshots.map((snapshot) => (
            <article key={snapshot.id} className="relative">
              {/* Timeline Indicator Dot */}
              <div className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full bg-blue-500 border-4 border-slate-100 dark:border-gray-900" />
              
              {/* Timeline Date Label */}
              <div className="mb-2">
                <time className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {formatDateIndo(snapshot.snapshot_date)}
                </time>
              </div>

              {/* Development Content Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                <h2 className="text-md font-semibold text-gray-800 dark:text-gray-100 mb-2 leading-snug">
                  - {snapshot.cluster_name}
                </h2>
                
                {snapshot.summary && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mt-2 whitespace-pre-line">
                    {snapshot.summary}
                  </p>
                )}

                {/* Meta details */}
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-50 dark:border-gray-700/50 text-xs text-gray-400 dark:text-gray-500">
                  <span>📄 {snapshot.article_count} artikel</span>
                  <span>•</span>
                  <span>🌐 {snapshot.source_count} media</span>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>

      <Footer />
    </div>
  )
}
