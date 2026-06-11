import Link from 'next/link'
import ErrorCard from '../shared/ErrorCard'

type TemplateItem = {
  title: string
  description?: string
  link?: string
  badgeText?: string
}

type Props = {
  title?: string
  subtitle?: string
  description?: string
  icon?: string
  statusLabel?: string
  items?: TemplateItem[]
  footerLink?: { href: string; label: string }
}

export default function TemplateCard({
  title = 'Judul Kartu',
  subtitle = 'Subjudul',
  description = 'Deskripsi singkat atau konteks untuk kartu ini.',
  icon = '🧩',
  statusLabel = 'Status',
  items = [],
  footerLink,
}: Props) {
  if (!items || items.length === 0) {
    return <ErrorCard message="Tidak ada data untuk ditampilkan pada kartu ini." />
  }

  return (
    <section
      aria-labelledby="template-card-heading"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
        <div>
          <h2
            id="template-card-heading"
            className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"
          >
            <span aria-hidden="true">{icon}</span>
            {title}
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">{statusLabel}</span>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>

        <div className="space-y-3">
          {items.map((item, index) => (
            <article
              key={index}
              className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                    {item.title}
                  </h3>
                  {item.description ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  ) : null}
                </div>
                {item.badgeText ? (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {item.badgeText}
                  </span>
                ) : null}
              </div>

              {item.link ? (
                <div className="mt-3">
                  <Link
                    href={item.link}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    Lihat detail →
                  </Link>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>

      {footerLink ? (
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20">
          <Link
            href={footerLink.href}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            {footerLink.label}
          </Link>
        </div>
      ) : null}
    </section>
  )
}
