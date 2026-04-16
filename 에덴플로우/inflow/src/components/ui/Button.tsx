import React from 'react'

type Variant = 'primary' | 'dark' | 'outline' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  children: React.ReactNode
}

const variantClass: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200',
  dark:    'bg-slate-900 text-white hover:bg-slate-800',
  outline: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
  ghost:   'bg-transparent text-slate-600 hover:bg-slate-100',
}

const sizeClass: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-xl',
  md: 'px-5 py-3 text-sm rounded-xl',
  lg: 'px-8 py-4 text-base rounded-2xl',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        font-bold transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClass[variant]}
        ${sizeClass[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  )
}
