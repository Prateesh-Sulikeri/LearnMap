import type { ComponentType } from 'react'
import { Card, CardContent } from '@/components/ui/card'

interface StatCardProps {
  label: string
  value: string
  icon: ComponentType<{ className?: string }>
}

export function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-2xl leading-none font-semibold">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
