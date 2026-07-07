import { cn } from '@/lib/utils'

// min-w (not a fixed size) so longer labels — "10a2", "25b3" and beyond for
// deep/wide trees — grow into a pill instead of clipping; short labels
// ("1", "2a") still read as a circle since min-width equals the height.
export function NumberBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted px-1 font-mono text-[0.6rem] font-semibold whitespace-nowrap text-muted-foreground',
        className,
      )}
    >
      {label}
    </span>
  )
}
