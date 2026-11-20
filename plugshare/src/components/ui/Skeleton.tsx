import type { CSSProperties } from 'react'

export type SkeletonProps = {
  width?: CSSProperties['width']
  height?: CSSProperties['height']
  className?: string
}

export function Skeleton({ width, height, className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        'w-full animate-pulse rounded-md bg-[var(--color-surface-muted)] motion-reduce:animate-none',
        className,
      ].filter(Boolean).join(' ')}
      style={{ width, height: height ?? '1rem' }}
    />
  )
}
