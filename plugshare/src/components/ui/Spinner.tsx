import { Loader2 } from 'lucide-react'

export type SpinnerSize = 'sm' | 'md' | 'lg'

export type SpinnerProps = {
  size?: SpinnerSize
  label?: string
  className?: string
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
}

export function Spinner({ size = 'md', label = 'Loading', className }: SpinnerProps) {
  return (
    <span
      aria-label={label}
      className={['inline-flex', className].filter(Boolean).join(' ')}
      role="status"
    >
      <Loader2
        aria-hidden="true"
        className={[
          sizeClasses[size],
          'animate-spin motion-reduce:animate-none',
        ].join(' ')}
      />
    </span>
  )
}
