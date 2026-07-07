import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StickyNote } from 'lucide-react'
import { toast } from 'sonner'
import { itemsApi } from '@/services/itemsApi'
import { getApiErrorMessage } from '@/utils/apiError'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface NoteIndicatorProps {
  itemId: string
  note: string
}

/** A small click target that reveals — and lets you edit — an item's notes. Shown only when the item has any. */
export function NoteIndicator({ itemId, note }: NoteIndicatorProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(note)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (open) setValue(note)
  }, [open, note])

  const save = useMutation({
    mutationFn: () => itemsApi.update(itemId, { description: value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      toast.success('Note saved')
      setOpen(false)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex shrink-0" />}>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 text-primary hover:text-primary"
                aria-label="View or edit notes"
              />
            }
          >
            <StickyNote className="size-3.5" />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>View or edit notes</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="space-y-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          placeholder="Add a short note…"
          autoFocus
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
