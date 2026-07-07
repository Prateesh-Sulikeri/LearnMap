import { StickyNote } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** A small hover target that reveals an item's notes — shown only when the item has any. */
export function NoteIndicator({ note }: { note: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex shrink-0 text-muted-foreground hover:text-foreground" />}>
        <StickyNote className="size-3.5" aria-label="Has notes" />
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-left whitespace-pre-wrap">{note}</TooltipContent>
    </Tooltip>
  )
}
