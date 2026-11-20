import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { LinkProps, To } from 'react-router-dom'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

type SharedButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  className?: string
  children?: ReactNode
}

type NativeButtonProps = SharedButtonProps
  & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof SharedButtonProps>
  & { to?: never }

type LinkButtonProps = SharedButtonProps
  & Omit<LinkProps, keyof SharedButtonProps | 'to'>
  & { to: To }

export type ButtonProps = NativeButtonProps | LinkButtonProps

const variantClasses: Record<ButtonVariant, { base: string; hover: string }> = {
  primary: {
    base: 'bg-[var(--color-brand)] text-[var(--color-surface)]',
    hover: 'hover:bg-[var(--color-brand-hover)]',
  },
  secondary: {
    base: 'border border-[var(--color-brand)] bg-[var(--color-surface)] text-[var(--color-brand)]',
    hover: 'hover:bg-[var(--color-surface-muted)]',
  },
  ghost: {
    base: 'bg-transparent text-[var(--color-brand)]',
    hover: 'hover:bg-[var(--color-surface-muted)]',
  },
  danger: {
    base: 'bg-[var(--color-error)] text-[var(--color-surface)]',
    hover: 'hover:brightness-95',
  },
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-6 text-base',
}

function getButtonClassName(
  variant: ButtonVariant,
  size: ButtonSize,
  inactive: boolean,
  className?: string,
): string {
  const interactionClasses = inactive
    ? 'cursor-not-allowed border-[var(--color-border)] bg-[var(--color-disabled-bg)] text-[var(--color-disabled-text)]'
    : `cursor-pointer ${variantClasses[variant].hover} active:scale-[0.98] motion-reduce:active:scale-100`

  return [
    'inline-flex items-center justify-center gap-2 rounded-[var(--radius-btn)] font-medium',
    'transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2',
    'motion-reduce:transition-none',
    variantClasses[variant].base,
    sizeClasses[size],
    interactionClasses,
    className,
  ].filter(Boolean).join(' ')
}

function ButtonContents({
  loading,
  leftIcon,
  rightIcon,
  children,
}: Pick<SharedButtonProps, 'loading' | 'leftIcon' | 'rightIcon' | 'children'>) {
  return (
    <>
      {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </>
  )
}

export function Button(props: ButtonProps) {
  if ('to' in props && props.to !== undefined) {
    const {
      to,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      className,
      children,
      onClick,
      tabIndex,
      ...linkProps
    } = props
    const inactive = disabled || loading

    const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
      if (inactive) {
        event.preventDefault()
        return
      }
      onClick?.(event)
    }

    return (
      <Link
        {...linkProps}
        aria-busy={loading || undefined}
        aria-disabled={inactive || undefined}
        className={getButtonClassName(variant, size, inactive, className)}
        onClick={handleClick}
        tabIndex={inactive ? -1 : tabIndex}
        to={to}
      >
        <ButtonContents
          loading={loading}
          leftIcon={leftIcon}
          rightIcon={rightIcon}
        >
          {children}
        </ButtonContents>
      </Link>
    )
  }

  const {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    className,
    children,
    type = 'button',
    ...buttonProps
  } = props
  const inactive = disabled || loading

  return (
    <button
      {...buttonProps}
      aria-busy={loading || undefined}
      className={getButtonClassName(variant, size, inactive, className)}
      disabled={inactive}
      type={type}
    >
      <ButtonContents
        loading={loading}
        leftIcon={leftIcon}
        rightIcon={rightIcon}
      >
        {children}
      </ButtonContents>
    </button>
  )
}
