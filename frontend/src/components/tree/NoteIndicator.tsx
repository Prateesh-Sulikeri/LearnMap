import { StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface NoteIndicatorProps {
  note: string | null
  onClick: () => void
}

// Always rendered (not just when a note already exists) so a first note can
// be started straight from the tree row — the actual editor lives in a
// single page-level NotesEditorDialog, opened via onClick.
export function NoteIndicator({ note, onClick }: NoteIndicatorProps) {
  const hasNote = Boolean(note?.trim())
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn('size-6 shrink-0', hasNote ? 'text-primary hover:text-primary' : 'text-muted-foreground/50')}
            aria-label={hasNote ? 'View or edit notes' : 'Add notes'}
            onClick={onClick}
          />
        }
      >
        <StickyNote className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{hasNote ? 'View or edit notes' : 'Add notes'}</TooltipContent>
    </Tooltip>
  )
}
