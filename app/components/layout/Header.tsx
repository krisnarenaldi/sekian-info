import Link from 'next/link'
import ThemeToggle from './ThemeToggle'

/**
 * Header — sticky top navbar with Chomsky font logo (center), date (left), and dark mode toggle (right).
 */
export default function Header() {
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }
  const today = new Date().toLocaleDateString('id-ID', dateOptions)

  const islamicOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    calendar: 'islamic',
    timeZone: 'Asia/Jakarta',
  }
  const islamic = new Date().toLocaleDateString('id-ID', islamicOptions)

  return (
    <header className="sticky top-0 z-50  dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm bg-[#f4f4f5]">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Tanggal — kiri */}
        <div className="hidden sm:flex flex-col shrink-0">
          <span className="text-xs text-gray-400 dark:text-gray-500">{today} / {islamic}</span>          
        </div>

        {/* Spacer biar logo tetap di tengah */}
        <div className="flex-1" />

        {/* Logo — font Chomsky, center, with 3 stars on each side */}
        <Link href="/" className="flex items-center gap-2 select-none hover:opacity-80 transition-opacity">
          <span className="flex gap-1 text-xs sm:text-sm text-gray-900 dark:text-white" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 sm:w-4 sm:h-4"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            {/* <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 sm:w-4 sm:h-4"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 sm:w-4 sm:h-4"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> */}
          </span>
          <span className="font-[family-name:var(--font-chomsky)] text-4xl sm:text-5xl text-gray-900 dark:text-white leading-none">
            Sekian Info
          </span>
          <span className="flex gap-1 text-xs sm:text-sm text-gray-900 dark:text-white" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 sm:w-4 sm:h-4"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            {/* <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 sm:w-4 sm:h-4"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 sm:w-4 sm:h-4"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> */}
          </span>
        </Link>

        {/* Spacer biar logo tetap di tengah */}
        <div className="flex-1" />

        {/* Controls — kanan */}
        <ThemeToggle />
      </div>
    </header>
  )
}
