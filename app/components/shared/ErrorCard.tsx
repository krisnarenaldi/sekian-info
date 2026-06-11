type ErrorCardProps = {
  message?: string
}

export default function ErrorCard({
  message = 'Data sedang diperbarui, coba lagi nanti',
}: ErrorCardProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-100 dark:border-red-900/30 p-5"
    >
      <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">Oops!</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
    </div>
  )
}
