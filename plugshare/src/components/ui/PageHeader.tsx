import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { To } from 'react-router-dom'

export type PageHeaderProps = {
  title: string
  subtitle?: string
  backTo?: To
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, backTo, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {backTo && (
          <Link
            className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-btn)] text-sm font-medium text-[var(--color-brand)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"
            to={backTo}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <span>Back</span>
          </Link>
        )}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--color-text)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  )
}
