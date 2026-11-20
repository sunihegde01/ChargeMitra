import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Label } from './Label'

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: boolean
  leadingIcon?: LucideIcon
  trailingIcon?: LucideIcon
}

const baseClassName = [
  'h-11 w-full rounded-[var(--radius-input)] border bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)]',
  'placeholder:text-[var(--color-text-muted)] transition-colors duration-150',
  'focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2',
  'disabled:cursor-not-allowed disabled:bg-[var(--color-disabled-bg)] disabled:text-[var(--color-disabled-text)]',
  'motion-reduce:transition-none',
].join(' ')

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error = false,
    leadingIcon: LeadingIcon,
    trailingIcon: TrailingIcon,
    className,
    id,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...inputProps
  },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined
  const describedBy = [ariaDescribedBy, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className="grid gap-1.5">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <div className="relative">
        {LeadingIcon && (
          <LeadingIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
        )}
        <input
          {...inputProps}
          ref={ref}
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={error || ariaInvalid || undefined}
          className={[
            baseClassName,
            error
              ? 'border-[var(--color-error)] enabled:hover:border-[var(--color-error)]'
              : 'border-[var(--color-border)] enabled:hover:border-[var(--color-brand)]',
            LeadingIcon ? 'pl-10' : '',
            TrailingIcon ? 'pr-10' : '',
            className,
          ].filter(Boolean).join(' ')}
        />
        {TrailingIcon && (
          <TrailingIcon
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
        )}
      </div>
      {hint && (
        <p className="text-xs text-[var(--color-text-muted)]" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  )
})

Input.displayName = 'Input'
