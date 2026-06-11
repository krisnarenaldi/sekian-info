'use client'

import { useEffect, useState } from 'react'
import ErrorCard from '../shared/ErrorCard'
import CardSkeleton from '../shared/CardSkeleton'

interface SingleNewsCardProps {
  className?: string
  title?: string
  rssUrl?: string
}

interface RSSItem {
  title: string | undefined
  description: string | undefined
  link: string | undefined
  image: string | undefined
  source: string
}

export default function SingleNewsCard({
  className = '',
  title = 'Berita',
  rssUrl,
}: SingleNewsCardProps) {
  const [item, setItem] = useState<RSSItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!rssUrl) {
      setLoading(false)
      setError(true)
      return
    }

    let cancelled = false

    async function fetchNews() {
      try {
        const res = await fetch(`/api/rss-proxy?url=${encodeURIComponent(rssUrl!)}`)
        if (!res.ok) throw new Error('Failed to fetch RSS')
        const data = await res.json()
        if (!cancelled) {
          if (data.items && data.items.length > 0) {
            setItem(data.items[0])
          } else {
            setError(true)
          }
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    }

    fetchNews()

    return () => {
      cancelled = true
    }
  }, [rssUrl])

  if (loading) {
    return <CardSkeleton />
  }

  if (error || !item) {
    return <ErrorCard message={`Gagal memuat ${title}`} />
  }

  const heroImage = item.image
  const topicLabel = item.title || title
  const description = item.description || ''
  const articleLink = item.link || '#'

  return (
    <section
      aria-labelledby="single-news-heading"
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden ${className}`}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-[#f5f5f4]">
        <h2
          id="single-news-heading"
          className="text-sm font-bold text-gray-800 dark:text-gray-100"
        >
          {title}
        </h2>
        {/*<span className="text-xs text-gray-400 dark:text-gray-500">
          {item.source}
        </span>*/}
      </div>

      {/* Hero image with text overlay */}
      {heroImage ? (
        <a
          href={articleLink}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block w-full h-56 overflow-hidden group"
          aria-label={`Baca lebih lanjut tentang ${topicLabel}`}
        >
          <img
            src={heroImage}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          {/* Text content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-white text-sm font-bold leading-snug drop-shadow-sm">
              {topicLabel}
            </h3>
            {description && (
              <p className="text-white/80 text-xs mt-1 leading-relaxed line-clamp-2 drop-shadow-sm">
                {description}
              </p>
            )}
          </div>
        </a>
      ) : (
        /* No image — show text content directly */
        <a
          href={articleLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
        >
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 leading-snug">
            {topicLabel}
          </h3>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-3">
              {description}
            </p>
          )}
        </a>
      )}

      {/* Footer link 
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20">
        <a
          href={articleLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded transition-colors"
          aria-label={`Baca selengkapnya di ${item.source}`}
        >
          Baca selengkapnya →
        </a>
      </div>
      */}
    </section>
  )
}