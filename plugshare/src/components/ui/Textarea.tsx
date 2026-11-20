import { forwardRef, useId } from 'react'
import type { TextareaHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Label } from './Label'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  hint?: string
  error?: boolean
  leadingIcon?: LucideIcon
  trailingIcon?: LucideIcon
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    hint,
    error = false,
    leadingIcon: LeadingIcon,
    trailingIcon: TrailingIcon,
    className,
    id,
    rows = 4,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...textareaProps
  },
  ref,
) {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  const hintId = hint ? `${textareaId}-hint` : undefined
  const describedBy = [ariaDescribedBy, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className="grid gap-1.5">
      {label && <Label htmlFor={textareaId}>{label}</Label>}
      <div className="relative">
        {LeadingIcon && (
          <LeadingIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3 size-4 text-[var(--color-text-muted)]"
          />
        )}
        <textarea
          {...textareaProps}
          ref={ref}
          id={textareaId}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={error || ariaInvalid || undefined}
          className={[
            'min-h-28 w-full rounded-[var(--radius-input)] border bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)]',
            'placeholder:text-[var(--color-text-muted)] transition-colors duration-150',
            'focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2',
            'disabled:cursor-not-allowed disabled:bg-[var(--color-disabled-bg)] disabled:text-[var(--color-disabled-text)]',
            'motion-reduce:transition-none',
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
            className="pointer-events-none absolute right-3 top-3 size-4 text-[var(--color-text-muted)]"
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

Textarea.displayName = 'Textarea'
