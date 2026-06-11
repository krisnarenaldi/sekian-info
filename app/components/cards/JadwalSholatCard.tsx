'use client'

import { useState, useEffect, useMemo } from 'react'

// === Types ================================================================

type CityItem = {
  id: string
  lokasi: string
}

type JadwalData = {
  tanggal: string
  imsak: string
  subuh: string
  terbit: string
  dhuha: string
  dzuhur: string
  ashar: string
  maghrib: string
  isya: string
  [key: string]: string
}

type JadwalResponse = {
  status: boolean
  data?: {
    id: string
    lokasi: string
    daerah: string
    jadwal: JadwalData
  }
}

// === Constants ============================================================

const PRAYER_ORDER = ['imsak', 'subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'] as const

const PRAYER_LABELS: Record<string, string> = {
  imsak: 'Imsak',
  subuh: 'Subuh',
  dzuhur: 'Dzuhur',
  ashar: 'Ashar',
  maghrib: 'Maghrib',
  isya: 'Isya',
}

// === Helpers ==============================================================

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

/** Get current hours & minutes in WIB (Asia/Jakarta). */
function getCurrentWIBTime(): { hours: number; minutes: number; totalMinutes: number } {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('id-ID', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  })
  const parts = formatter.formatToParts(now)
  const hours = parseInt(parts.find(p => p.type === 'hour')!.value, 10)
  const minutes = parseInt(parts.find(p => p.type === 'minute')!.value, 10)
  return { hours, minutes, totalMinutes: hours * 60 + minutes }
}

/** Current time as "HH:mm:ss WIB" string */
function getWIBTimeString(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  })
  return formatter.format(now) + ' WIB'
}

// === Component ============================================================

export default function JadwalSholatCard() {
  const [cityName, setCityName] = useState('Jakarta')
  const [schedule, setSchedule] = useState<JadwalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0) // re-render clock every second
  const [detectedCity, setDetectedCity] = useState(false)

  // Live clock – re-render every 1 second
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1_000)
    return () => clearInterval(timer)
  }, [])

  // Detect city & fetch schedule on mount
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        // Try to detect city via IP geolocation
        const geoRes = await fetch('https://ip-api.com/json/?fields=city')
        if (geoRes.ok) {
          const geoData = await geoRes.json()
          if (geoData?.city) {
            setDetectedCity(true)
            await fetchScheduleByCity(geoData.city, cancelled)
            return
          }
        }
      } catch {
        // fallback to Jakarta
      }
      // if detection failed, use Jakarta
      await fetchScheduleByCity('Jakarta', cancelled)
    }

    init()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchScheduleByCity(cityToSearch: string, cancelled: boolean) {
    try {
      const cityRes = await fetch(
        `https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(cityToSearch)}`,
      )
      const cityData = await cityRes.json()

      if (!cityData.status || !cityData.data || cityData.data.length === 0) {
        // Fallback to Jakarta
        const jakartaRes = await fetch(
          'https://api.myquran.com/v2/sholat/kota/cari/Jakarta',
        )
        const jakartaData = await jakartaRes.json()
        if (!jakartaData.status || !jakartaData.data || jakartaData.data.length === 0) {
          throw new Error('Tidak dapat menemukan kota')
        }
        const city = jakartaData.data[0] as CityItem
        if (!cancelled) setCityName(city.lokasi)
        await fetchJadwal(city.id, cancelled)
        return
      }

      const city = cityData.data[0] as CityItem
      if (!cancelled) setCityName(city.lokasi)
      await fetchJadwal(city.id, cancelled)
    } catch (err) {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Gagal memuat jadwal sholat')
        setLoading(false)
      }
    }
  }

  async function fetchJadwal(cityId: string, cancelled: boolean) {
    try {
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')

      const res = await fetch(
        `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${year}/${month}/${day}`,
      )
      const data: JadwalResponse = await res.json()

      if (!data.status || !data.data) {
        throw new Error('Gagal memuat jadwal sholat')
      }

      if (!cancelled) setSchedule(data.data.jadwal)
    } catch (err) {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Gagal memuat jadwal sholat')
      }
    } finally {
      if (!cancelled) setLoading(false)
    }
  }

  // ── Determine next prayer & the one after ────────────────────────────────
  const wibTime = useMemo(() => getCurrentWIBTime(), [tick])

  const prayerInfo = useMemo(() => {
    if (!schedule) return { current: null, next: null }

    const times = PRAYER_ORDER.map(name => ({
      name,
      label: PRAYER_LABELS[name],
      minutes: parseTimeToMinutes(schedule[name]),
    }))

    // Find the next upcoming prayer (first one whose time is > now)
    let nextIdx = -1
    for (let i = 0; i < times.length; i++) {
      if (times[i].minutes > wibTime.totalMinutes) {
        nextIdx = i
        break
      }
    }

    // If all prayers have passed today, wrap to tomorrow's first prayer (imsak)
    if (nextIdx === -1) {
      nextIdx = 0
    }

    const current = times[nextIdx]
    const next = times[(nextIdx + 1) % times.length]

    return { current, next }
  }, [schedule, wibTime])

  // ── Render ───────────────────────────────────────────────────────────────

  // Loading skeleton
  if (loading) {
    return (
      <section className="relative rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
        <div className="p-5 text-center text-sm text-gray-400 dark:text-gray-500">
          Memuat jadwal sholat...
        </div>
      </section>
    )
  }

  // Error state
  if (error || !schedule) {
    return (
      <section className="relative rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
        <div className="p-5 text-center text-sm text-red-400">
          {error || 'Jadwal tidak tersedia'}
        </div>
      </section>
    )
  }

  const wibTimeString = getWIBTimeString()

  return (
    <section
      aria-labelledby="jadwal-sholat-heading"
      className="relative rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      {/* Background Image with overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/kabah2.jpg')" }}
      />
      <div className="absolute inset-0 bg-black/50" />

      {/* Content */}
      <div className="relative z-10 p-5 text-white">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2
              id="jadwal-sholat-heading"
              className="text-sm font-bold flex items-center gap-2"
            >
              <span aria-hidden="true">🕌</span>
              Jadwal Sholat
            </h2>
            <p className="text-xs text-white/60 mt-0.5">
              {cityName}
              {detectedCity ? (
                <span className="ml-1 text-white/40">(terdeteksi)</span>
              ) : null}
            </p>
          </div>
          {/* Live clock 
          <div className="text-right">
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Sekarang</p>
            <p className="text-sm font-mono font-semibold tabular-nums">
              {wibTimeString}
            </p>
          </div>
          */}
        </div>

        {/* Highlight: current & next prayer */}
        {prayerInfo.current && prayerInfo.next && (
          <div className="text-center mb-5">
            <p className="text-2xl font-bold tracking-tight">
              {prayerInfo.current.label}{' '}
              <span className="font-mono">{schedule[prayerInfo.current.name]}</span>
            </p>
            <p className="text-sm text-white/70 mt-1">
              Selanjutnya:{' '}
              <span className="font-medium">
                {prayerInfo.next.label} –{' '}
                <span className="font-mono">{schedule[prayerInfo.next.name]}</span>
              </span>
            </p>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-white/10 mb-3" />

        {/* Full schedule list */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-2">
            Jadwal Lengkap Hari Ini
          </p>
          <div className="space-y-0.5">
            {PRAYER_ORDER.map(name => {
              const isCurrent = prayerInfo.current?.name === name
              const isNext = prayerInfo.next?.name === name

              return (
                <div
                  key={name}
                  className={`flex justify-between items-center text-sm px-3 py-1.5 rounded-lg transition-colors ${
                    isCurrent
                      ? 'bg-white/20 font-semibold'
                      : isNext
                        ? 'bg-white/10'
                        : 'hover:bg-white/5'
                  }`}
                >
                  <span className="text-white/90">{PRAYER_LABELS[name]}</span>
                  <span className="font-mono tabular-nums">{schedule[name]}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <p className="text-[10px] text-white/40 text-center">
            Sumber:{' '}
            <a
              href="https://myquran.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white/60 transition-colors"
            >
              MyQuran.com
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}