import type { MarketDataRow, StockItem } from '@/lib/supabase/queries/market-data'

type Props = {
  marketData: MarketDataRow | null
}

function fmt(value: number | null | undefined): string {
  if (value == null) return '-'
  return value.toLocaleString('id-ID')
}

function truncate2(text: string): string {
  const m = text.match(/[^.!?]*[.!?]+(?:\s|$)/g)
  if (!m) return text
  return m.slice(0, 2).join('').trim()
}

function StockRow({ stock }: { stock: StockItem }) {
  const pos = stock.change_pct > 0
  return (
    <li className="flex items-center justify-between text-xs gap-2">
      <span className="font-medium text-gray-700 dark:text-gray-300">{stock.code}</span>
      <span className="text-gray-400 dark:text-gray-500 flex-1 truncate px-1">{stock.name}</span>
      <span className={pos ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
        {pos ? '+' : ''}{stock.change_pct.toFixed(2)}%
      </span>
    </li>
  )
}

export default function PasarHariIniCard({ marketData }: Props) {
  const ihsg      = marketData?.ihsg ?? null
  const change    = marketData?.ihsg_change ?? null
  const usdIdr    = marketData?.usd_idr ?? null
  const gold      = marketData?.gold_price ?? null
  const gainer    = marketData?.top_gainer ?? null
  const loser     = marketData?.top_loser ?? null
  const insight   = marketData?.ai_insight ?? null

  const pos = change !== null && change > 0
  const neg = change !== null && change < 0

  return (
    <section
      aria-label="Pasar Hari Ini"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-[#e4e4e7]">
        <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <span aria-hidden="true">📈</span> Pasar Info
        </h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">Keuangan</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-3">
          {/* IHSG */}
          <div className="col-span-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">IHSG</p>
            <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">{fmt(ihsg)}</p>
            {change !== null ? (
              <p className={`text-xs font-semibold mt-0.5 ${pos ? 'text-green-600 dark:text-green-400' : neg ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>
                {pos ? '+' : ''}{change.toFixed(2)}%
              </p>
            ) : <p className="text-xs text-gray-400 mt-0.5">-</p>}
          </div>

          {/* USD/IDR */}
          <div className="col-span-1 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">USD/IDR</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5 leading-tight">
              {usdIdr !== null ? `Rp ${fmt(usdIdr)}` : '-'}
            </p>
          </div>

          {/* Emas */}
          <div className="col-span-1 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Emas</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5 leading-tight">
              {gold !== null ? `Rp ${fmt(gold)}` : '-'}
            </p>
          </div>
        </div>

        {/* Gainer / Loser */}
        {(gainer?.length || loser?.length) ? (
          <div className="grid grid-cols-2 gap-3">
            {gainer?.length ? (
              <div>
                <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1.5 flex items-center gap-1">
                  <span aria-hidden="true">▲</span> Top Gainer
                </p>
                <ul className="space-y-1">
                  {gainer.map(s => <StockRow key={s.code} stock={s} />)}
                </ul>
              </div>
            ) : null}
            {loser?.length ? (
              <div>
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1.5 flex items-center gap-1">
                  <span aria-hidden="true">▼</span> Top Loser
                </p>
                <ul className="space-y-1">
                  {loser.map(s => <StockRow key={s.code} stock={s} />)}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* AI Insight */}
        {insight && (
          <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg border-l-2 border-blue-400">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">AI Insight</p>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed italic">
              {truncate2(insight)}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
