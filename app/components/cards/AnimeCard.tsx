'use client'

import { useEffect, useState } from 'react'
import ErrorCard from '../shared/ErrorCard'
import CardSkeleton from '../shared/CardSkeleton'

interface AnimeData {
  title: string
  picture: string
  sources: string[]
  type: string
  episodes: number
  status: string
  animeSeason: {
    season: string
    year: number
  }
  duration: {
    value: number
    unit: string
  }
}

type Props = {
  className?: string
  title?: string
}

export default function AnimeCard({
  className = '',
  title = 'Random Anime',
}: Props) {
  const [anime, setAnime] = useState<AnimeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchAnime() {
      try {
        const res = await fetch('https://api.rei.my.id/anime/random')
        if (!res.ok) throw new Error('Failed to fetch anime')
        const data: AnimeData = await res.json()
        if (!cancelled) {
          setAnime(data)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    }

    fetchAnime()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <CardSkeleton label="Memuat anime acak" />
  }

  if (error || !anime) {
    return <ErrorCard message="Gagal memuat anime acak" />
  }

  const heroImage = anime.picture
  const topicLabel = anime.title
  const articleLink = anime.sources?.[0] || '#'

  return (
    <section
      aria-labelledby="anime-card-heading"
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden ${className}`}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
        <h2
          id="anime-card-heading"
          className="text-sm font-bold text-gray-800 dark:text-gray-100"
        >
          {title}
        </h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {anime.type}
        </span>
      </div>

      {/* Hero image with text overlay */}
      {heroImage ? (
        <a
          href={articleLink}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block w-full h-56 overflow-hidden group"
          aria-label={`Lihat detail tentang ${topicLabel}`}
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
            <p className="text-white/80 text-xs mt-1 leading-relaxed drop-shadow-sm">
              {anime.animeSeason.season} {anime.animeSeason.year} · {anime.episodes} episode · {anime.status}
            </p>
          </div>
        </a>
      ) : (
        /* No image — show text content directly */
        <div className="p-5">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 leading-snug">
            {topicLabel}
          </h3>
        </div>
      )}
    </section>
  )
}