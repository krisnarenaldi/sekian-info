import React from 'react'

/**
 * True masonry layout using CSS columns.
 * Cards flow top-to-bottom then left-to-right, filling gaps naturally.
 * Responsive breakpoints:
 *   1 col (default) → 2 col (≥640px) → 3 col (≥1024px) → 4 col (≥1440px)
 */
export default function MasonryGrid({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`masonry-grid ${className}`}
    >
      {children}
    </div>
  )
}