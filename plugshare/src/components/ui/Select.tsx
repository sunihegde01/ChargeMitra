import { useId } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { Label } from './Label'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  hint?: string
  error?: boolean
}

export function Select({
  label,
  hint,
  error = false,
  className,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  children,
  ...selectProps
}: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const hintId = hint ? `${selectId}-hint` : undefined
  const describedBy = [ariaDescribedBy, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className="grid gap-1.5">
      {label && <Label htmlFor={selectId}>{label}</Label>}
      <div className="relative">
        <select
          {...selectProps}
          id={selectId}
          aria-describedby={describedBy}
          aria-invalid={error || ariaInvalid || undefined}
          className={[
            'h-11 w-full appearance-none rounded-[var(--radius-input)] border bg-[var(--color-surface)] px-3 pr-10 text-sm text-[var(--color-text)]',
            'transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2',
            'disabled:cursor-not-allowed disabled:bg-[var(--color-disabled-bg)] disabled:text-[var(--color-disabled-text)]',
            'motion-reduce:transition-none',
            error
              ? 'border-[var(--color-error)] enabled:hover:border-[var(--color-error)]'
              : 'border-[var(--color-border)] enabled:hover:border-[var(--color-brand)]',
            className,
          ].filter(Boolean).join(' ')}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
      </div>
      {hint && (
        <p className="text-xs text-[var(--color-text-muted)]" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  )
}
