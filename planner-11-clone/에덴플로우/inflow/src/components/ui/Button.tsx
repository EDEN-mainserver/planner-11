import { cn } from '@/lib/utils'
interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary'|'outline'|'ghost'; size?: 'sm'|'md'|'lg'
}
export default function Button({ variant='primary', size='md', className, children, ...props }: Props) {
  return (
    <button className={cn(
      'inline-flex items-center justify-center font-semibold rounded-2xl transition',
      variant==='primary' && 'bg-indigo-600 text-white hover:bg-indigo-700',
      variant==='outline' && 'border border-slate-200 text-slate-700 hover:border-indigo-300 bg-white',
      variant==='ghost' && 'text-slate-600 hover:bg-slate-100',
      size==='sm' && 'px-3 py-1.5 text-xs',
      size==='md' && 'px-5 py-2.5 text-sm',
      size==='lg' && 'px-6 py-3 text-base',
      className
    )} {...props}>{children}</button>
  )
}
