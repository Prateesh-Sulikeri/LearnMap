import { cn } from '@/lib/utils'

export function NumberBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[0.6rem] font-semibold text-muted-foreground',
        className,
      )}
    >
      {label}
    </span>
  )
}
