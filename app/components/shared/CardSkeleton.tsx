type Props = {
  label?: string
}

export default function CardSkeleton({ label = 'Memuat konten, harap tunggu' }: Props) {
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 space-y-3 animate-pulse"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/5" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
