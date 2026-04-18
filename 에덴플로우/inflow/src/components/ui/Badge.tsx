import { cn } from '@/lib/utils'
interface Props { children: React.ReactNode; variant?: 'default'|'red'|'green'|'indigo'; className?: string }
export default function Badge({ children, variant='default', className }: Props) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold',
      variant==='default' && 'bg-slate-100 text-slate-600',
      variant==='red' && 'bg-red-100 text-red-600',
      variant==='green' && 'bg-green-100 text-green-700',
      variant==='indigo' && 'bg-indigo-100 text-indigo-700',
      className
    )}>{children}</span>
  )
}
