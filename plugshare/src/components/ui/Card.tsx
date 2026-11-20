import type { HTMLAttributes } from 'react'

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  p?: 5 | 6 | 7
}

type CardSectionProps = HTMLAttributes<HTMLDivElement>

const paddingClasses: Record<NonNullable<CardProps['p']>, string> = {
  5: 'p-5',
  6: 'p-6',
  7: 'p-7',
}

export function Card({ p = 6, className, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={[
        'rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]',
        paddingClasses[p],
        className,
      ].filter(Boolean).join(' ')}
    />
  )
}

export function CardHeader({ className, ...props }: CardSectionProps) {
  return (
    <div
      {...props}
      className={[
        'mb-4 flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4',
        className,
      ].filter(Boolean).join(' ')}
    />
  )
}

export function CardBody({ className, ...props }: CardSectionProps) {
  return <div {...props} className={className} />
}

export function CardFooter({ className, ...props }: CardSectionProps) {
  return (
    <div
      {...props}
      className={[
        'mt-4 flex items-center justify-end gap-3 border-t border-[var(--color-border)] pt-4',
        className,
      ].filter(Boolean).join(' ')}
    />
  )
}
