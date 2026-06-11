import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import ThemeProvider from './components/providers/ThemeProvider'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Sekian Info — Ringkasan Harian Indonesia',
    template: '%s — Sekian Info',
  },
  description:
    'Dashboard informasi harian Indonesia: ringkasan berita nasional, pasar, AI, trending, inspirasi, dan olahraga — semua dalam satu tempat.',
  icons: {
    icon: [
      { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/favicon/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Sekian Info — Ringkasan Harian Indonesia',
    description:
      'Dashboard informasi harian Indonesia: ringkasan berita nasional, pasar, AI, trending, inspirasi, dan olahraga — semua dalam satu tempat.',
    url: 'https://sekian-info.vercel.app',
    siteName: 'Sekian Info',
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sekian Info — Ringkasan Harian Indonesia',
    description:
      'Dashboard informasi harian Indonesia: ringkasan berita nasional, pasar, AI, trending, inspirasi, dan olahraga — semua dalam satu tempat.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID

  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-[--background] text-[--foreground]">
        <ThemeProvider>{children}</ThemeProvider>

        {/* Google Analytics v4 (GA4) — aktif jika NEXT_PUBLIC_GA_ID diisi */}
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}', {
                  page_path: window.location.pathname,
                });
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  )
}
