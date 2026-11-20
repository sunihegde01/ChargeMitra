import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-10 text-center">
      <Icon
        aria-hidden="true"
        className="size-8 text-[var(--color-text-muted)]"
        strokeWidth={1.75}
      />
      <h2 className="mt-4 font-display text-lg font-semibold text-[var(--color-text)]">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--color-text-muted)]">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </section>
  )
}
