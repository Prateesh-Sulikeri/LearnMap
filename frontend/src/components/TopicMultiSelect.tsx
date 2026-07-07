import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { LearningItem } from '@/types/api'

interface TopicMultiSelectProps {
  items: LearningItem[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  id?: string
}

export function TopicMultiSelect({ items, selectedIds, onChange, id }: TopicMultiSelectProps) {
  const titleById = new Map(items.map((item) => [item.id, item.title]))
  const label =
    selectedIds.length === 0
      ? 'Choose one or more topics'
      : selectedIds.length <= 2
        ? selectedIds.map((sid) => titleById.get(sid) ?? 'Unknown').join(', ')
        : `${selectedIds.length} topics selected`

  const toggle = (itemId: string) => {
    if (selectedIds.includes(itemId)) {
      onChange(selectedIds.filter((sid) => sid !== itemId))
    } else {
      onChange([...selectedIds, itemId])
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button id={id} type="button" variant="outline" className="w-full justify-between font-normal" />}
      >
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-64 overflow-y-auto">
        {items.map((item) => (
          <DropdownMenuCheckboxItem
            key={item.id}
            checked={selectedIds.includes(item.id)}
            onCheckedChange={() => toggle(item.id)}
            onSelect={(e) => e.preventDefault()}
          >
            {item.title}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
