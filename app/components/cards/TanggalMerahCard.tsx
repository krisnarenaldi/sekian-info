'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

// === Types ================================================================

type HolidayItem = {
  date: string
  day: string
  name: string
  type: string
}

type HolidayResponse = {
  success: boolean
  data: HolidayItem[]
  meta: {
    total: number
    total_holidays: number
    year: number
    month: number
  }
}

// === Component ============================================================

export default function TanggalMerahCard() {
  const [holidays, setHolidays] = useState<HolidayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [monthLabel, setMonthLabel] = useState('')

  useEffect(() => {
    let cancelled = false

    async function fetchHolidays() {
      try {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1 // 1-based

        // Set month label in Indonesian
        const monthNames = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
        ]
        if (!cancelled) setMonthLabel(monthNames[now.getMonth()])

        const res = await fetch(
          `https://tanggalmerah.upset.dev/api/holidays?year=${year}&month=${month}`,
        )
        if (!res.ok) throw new Error('Gagal mengambil data hari libur')

        const json: HolidayResponse = await res.json()

        if (!json.success || !json.data) {
          throw new Error('Respon API tidak valid')
        }

        // Filter holidays that are after today (including today if starting now)
        const todayStr = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        const upcoming = json.data.filter(item => item.date >= todayStr)

        if (!cancelled) setHolidays(upcoming)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal memuat data hari libur')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchHolidays()

    return () => {
      cancelled = true
    }
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────

  // Loading skeleton
  if (loading) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-5 text-center text-sm text-gray-400 dark:text-gray-500">
          Memuat tanggal merah...
        </div>
      </section>
    )
  }

  // Error state
  if (error) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-5 text-center text-sm text-red-400">{error}</div>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="tanggal-merah-heading"
      className="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/gunung-ciremai.jpg"
          alt=""
          fill
          className="object-cover opacity-50"
          aria-hidden="true"
        />
      </div>

      {/* Content overlay */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
        <div>
          <h2
            id="tanggal-merah-heading"
            className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"
          >
            <span aria-hidden="true">🔴</span>
            Tanggal Merah
          </h2>
          <p className="text-xs text-amber dark:text-white mt-0.5">
            {monthLabel} {new Date().getFullYear()}
          </p>
        </div>
        {holidays.length > 0 && (
          <span className="text-xs font-semibold text-green-600 dark:text-green-400">
            {holidays.length} libur tersisa
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {holidays.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-3xl mb-2">🏖️</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Tidak ada libur untuk bulan ini
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {holidays.map((item, index) => {
              // Parse date to get day number
              const dateObj = new Date(item.date)
              const dayNumber = dateObj.getDate()

              return (
                <article
                  key={index}
                  className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700"
                >
                  {/* Date badge */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-semibold text-red-500 dark:text-red-400 uppercase leading-tight">
                      {item.day.slice(0, 3)}
                    </span>
                    <span className="text-lg font-bold text-red-600 dark:text-red-300 leading-tight">
                      {dayNumber}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {item.day}, {dayNumber}{' '}
                      {new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(dateObj)}{' '}
                      {dateObj.getFullYear()}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20">
        <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
          Sumber:{' '}
          <a
            href="https://tanggalmerah.upset.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            tanggalmerah.upset.dev
          </a>
        </p>
      </div>
      </div>
    </section>
  )
}