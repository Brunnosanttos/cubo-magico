import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

const styles: Record<Variant, string> = {
  primary: 'bg-emerald-500 hover:bg-emerald-400 text-slate-900',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-50',
  ghost: 'bg-transparent hover:bg-slate-800 text-slate-100 border border-slate-700',
  danger: 'bg-rose-600 hover:bg-rose-500 text-white',
}

export function Button({ variant = 'primary', className = '', children, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`rounded-2xl px-5 py-3 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
