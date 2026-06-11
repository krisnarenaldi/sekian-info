import ErrorCard from '../shared/ErrorCard'
import type { InspirasiItem } from '@/lib/supabase/queries/inspirasi'

const TYPE_BADGE: Record<InspirasiItem['type'], { label: string; className: string }> = {
  quran:  { label: 'Al-Quran', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' },
  hadits: { label: 'Hadits',   className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' },
  quote:  { label: 'Quote',    className: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' },
}

type Props = {
  inspirasi: InspirasiItem | null
  hasError?: boolean
}

export default function InspirasiCard({ inspirasi, hasError = false }: Props) {
  if (hasError) {
    return <ErrorCard message="Konten inspirasi gagal dimuat. Coba muat ulang halaman." />
  }

  if (!inspirasi) return null

  const badge = TYPE_BADGE[inspirasi.type]

  return (
    <article
      aria-label={`Inspirasi Hari Ini — ${badge.label}`}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <span aria-hidden="true">☪️</span> Inspirasi Hari Ini
        </h2>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <div className="p-5">
        <blockquote cite={inspirasi.reference ?? undefined}>
          <p className="text-sm text-gray-700 dark:text-gray-200 italic leading-relaxed">
            "{inspirasi.content}"
          </p>
        </blockquote>

        {inspirasi.reference && (
          <footer className="mt-3">
            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              — {inspirasi.reference}
            </p>
          </footer>
        )}
      </div>
    </article>
  )
}
