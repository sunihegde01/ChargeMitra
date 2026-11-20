import type { ReactNode } from 'react'

export type StatusPillVariant = 'success' | 'warning' | 'error' | 'neutral' | 'accent'

export type StatusPillProps = {
  variant?: StatusPillVariant
  label: ReactNode
  className?: string
}

const variantClasses: Record<StatusPillVariant, { container: string; dot: string }> = {
  success: {
    container: 'bg-[var(--color-surface-muted)] text-[var(--color-success)]',
    dot: 'bg-[var(--color-success)]',
  },
  warning: {
    container: 'bg-[var(--color-surface-muted)] text-[var(--color-warning)]',
    dot: 'bg-[var(--color-warning)]',
  },
  error: {
    container: 'bg-[var(--color-surface-muted)] text-[var(--color-error)]',
    dot: 'bg-[var(--color-error)]',
  },
  neutral: {
    container: 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]',
    dot: 'bg-[var(--color-text-muted)]',
  },
  accent: {
    container: 'bg-[var(--color-accent)] text-[var(--color-brand)]',
    dot: 'bg-[var(--color-brand)]',
  },
}

export function StatusPill({
  variant = 'neutral',
  label,
  className,
}: StatusPillProps) {
  const styles = variantClasses[variant]

  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
        styles.container,
        className,
      ].filter(Boolean).join(' ')}
    >
      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${styles.dot}`} />
      {label}
    </span>
  )
}
