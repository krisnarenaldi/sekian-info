/**
 * A tiny inline SVG spark-area chart component.
 *
 * Renders a lightweight area chart without any external charting library.
 * Accepts an array of { date, value } points and draws the area + line.
 */

type DataPoint = {
  date: string
  value: number | null
}

type Props = {
  data: DataPoint[]
  /** CSS color for the line (default: currentColor) */
  lineColor?: string
  /** CSS color for the area fill gradient (default: transparent) */
  fillColor?: string
  /** Chart height in px (default: 48) */
  height?: number
  /** Chart width in px (default: full container via 100%) */
  width?: number
  /** Number of decimal places for the tooltip-style max/min labels (default: 2) */
  decimals?: number
  /** Show min/max labels? (default: false) */
  showLabels?: boolean
}

export default function SparkAreaChart({
  data,
  lineColor = '#3b82f6',
  fillColor = '#3b82f6',
  height = 48,
  width = 160,
  decimals = 2,
  showLabels = false,
}: Props) {
  const valid = data.filter((d) => d.value !== null && d.value !== undefined) as {
    date: string
    value: number
  }[]

  if (valid.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        role="img"
        aria-label="Chart — insufficient data"
      >
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-gray-400 dark:fill-gray-500 text-[10px]"
        >
          —
        </text>
      </svg>
    )
  }

  const values = valid.map((d) => d.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range = maxVal - minVal || 1

  const padding = 2
  const chartW = width - padding * 2
  const chartH = height - padding * 2

  const points = valid.map((d, i) => ({
    x: padding + (i / Math.max(valid.length - 1, 1)) * chartW,
    y: padding + chartH - ((d.value - minVal) / range) * chartH,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const areaPath =
    linePath +
    ` L${points[points.length - 1].x.toFixed(1)},${(padding + chartH).toFixed(1)}` +
    ` L${points[0].x.toFixed(1)},${(padding + chartH).toFixed(1)} Z`

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible"
      role="img"
      aria-label="Sparkline chart"
    >
      <defs>
        <linearGradient id={`grad-${lineColor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} stopOpacity={0.25} />
          <stop offset="100%" stopColor={fillColor} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path d={areaPath} fill={`url(#grad-${lineColor.replace('#', '')})`} />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={2}
        fill={lineColor}
      />

      {/* Labels */}
      {showLabels && (
        <>
          <text
            x={points[0].x}
            y={points[0].y - 4}
            textAnchor="start"
            className="fill-gray-400 dark:fill-gray-500 text-[9px]"
          >
            {minVal.toFixed(decimals)}
          </text>
          <text
            x={points[points.length - 1].x}
            y={points[points.length - 1].y - 4}
            textAnchor="end"
            className="fill-gray-500 dark:fill-gray-400 text-[9px]"
          >
            {maxVal.toFixed(decimals)}
          </text>
        </>
      )}
    </svg>
  )
}