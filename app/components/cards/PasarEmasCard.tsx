import type { MarketDataRow } from '@/lib/supabase/queries/market-data'
import SparkAreaChart from '../shared/SparkAreaChart'

type Props = {
  /** Historical market data rows sorted by date ascending */
  historyData: MarketDataRow[]
}

function fmt(value: number | null | undefined): string {
  if (value == null) return '-'
  return value.toLocaleString('id-ID')
}

export default function PasarEmasCard({ historyData }: Props) {
  const latest = historyData[historyData.length - 1]?.gold_price ?? null

  // Filter rows where gold_price is available
  const chartData = historyData
    .filter((d) => d.gold_price !== null)
    .map((d) => ({ date: d.date, value: d.gold_price! }))

  // Determine trend direction based on last vs first value
  const firstVal = chartData.length >= 2 ? chartData[0].value : null
  const lastVal = chartData.length >= 2 ? chartData[chartData.length - 1].value : null
  const trendUp = firstVal !== null && lastVal !== null && lastVal > firstVal
  const trendDown = firstVal !== null && lastVal !== null && lastVal < firstVal

  return (
    <section
      aria-label="Harga Emas"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-[#e4e4e7]">
        <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <span aria-hidden="true">🏅</span> Emas
        </h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">Harga</span>
      </div>

      <div className="p-4">
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                Harga / Gram
              </p>
              <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5 leading-tight">
                {latest !== null ? `Rp ${fmt(latest)}` : '-'}
              </p>
              {chartData.length >= 2 && (
                <p className={`text-xs font-semibold mt-0.5 ${trendUp ? 'text-green-600 dark:text-green-400' : trendDown ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>
                  Trend 30 hari: {trendUp ? 'Naik' : trendDown ? 'Turun' : 'Stabil'}
                </p>
              )}
            </div>
            {chartData.length >= 2 && (
              <SparkAreaChart
                data={chartData}
                lineColor={trendUp ? '#16a34a' : trendDown ? '#dc2626' : '#6b7280'}
                fillColor={trendUp ? '#16a34a' : trendDown ? '#dc2626' : '#6b7280'}
                height={48}
                width={140}
                decimals={0}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}