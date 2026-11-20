import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  children: ReactNode
}

const base = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
const styles = {
  primary: 'bg-deep-forest text-white shadow-sm hover:bg-[#244e42] hover:shadow-md',
  secondary: 'border border-sage-grey bg-white text-deep-forest hover:bg-warm-ivory',
}

export const Button = ({ variant = 'primary', className = '', children, ...props }: ButtonProps) => {
  return (
    <button className={`${base} ${styles[variant]} disabled:cursor-not-allowed disabled:opacity-60 ${className}`} {...props}>
      {children}
    </button>
  )
}

interface LinkButtonProps extends LinkProps {
  variant?: 'primary' | 'secondary'
  children: ReactNode
}

export const LinkButton = ({ variant = 'primary', className = '', children, ...props }: LinkButtonProps) => {
  return (
    <Link className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </Link>
  )
}
