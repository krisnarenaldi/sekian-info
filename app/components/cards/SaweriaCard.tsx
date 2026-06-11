import Image from 'next/image'
import Link from 'next/link'

export default function SaweriaCard() {
  return (
    <section
      aria-labelledby="saweria-card-heading"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700  bg-[#90a1b9]">
        <h2
          id="saweria-card-heading"
          className="text-sm font-bold text-gray-800 dark:text-gray-100"
        >
          Dukung Sekian Info
        </h2>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex justify-center">
          <Image
            src="/saweria2.png"
            alt="Saweria"
            width={200}
            height={200}
            className="rounded-lg object-contain"
          />
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          Website ini menggunakan AI untuk mengelompokkan dan merangkum berita dari
          berbagai sumber setiap hari.
        </p>

        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          Jika bermanfaat, dukung biaya operasional melalui{' '}
          <Link
            href="https://saweria.co/papaloni"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
          >
            Saweria
          </Link>
          .
        </p>
      </div>
    </section>
  )
}