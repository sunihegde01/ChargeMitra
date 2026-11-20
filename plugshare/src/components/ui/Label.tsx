import type { LabelHTMLAttributes } from 'react'

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      {...props}
      className={[
        'text-sm font-medium text-[var(--color-text)]',
        className,
      ].filter(Boolean).join(' ')}
    />
  )
}
