import { useRef, type RefObject } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Bold, Code, Heading1, Heading2, Image, Italic, List, Loader2, Scaling, SquareCode } from 'lucide-react'
import { toast } from 'sonner'
import { uploadsApi } from '@/services/uploadsApi'
import { getApiErrorMessage } from '@/utils/apiError'
import {
  insertAtCursor,
  insertCodeBlock,
  insertLinePrefix,
  setImageSize,
  wrapSelection,
  type EditResult,
} from '@/utils/markdownEditing'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (value: string) => void
}

// Applies an edit and restores focus/selection on the next frame — doing it
// synchronously would set the selection before React has flushed the new
// value to the DOM textarea, which causes the browser to silently clamp the
// selection back to the old (shorter) value.
function applyEdit(textarea: HTMLTextAreaElement, onChange: (value: string) => void, result: EditResult) {
  onChange(result.text)
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(result.selectionStart, result.selectionEnd)
  })
}

export function MarkdownToolbar({ textareaRef, value, onChange }: MarkdownToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const upload = useMutation({
    mutationFn: (file: File) => uploadsApi.uploadImage(file),
    onSuccess: (data) => {
      const textarea = textareaRef.current
      if (!textarea) return
      applyEdit(
        textarea,
        onChange,
        insertAtCursor(value, textarea.selectionStart, textarea.selectionEnd, `![alt text](${data.url})`, 2, 10),
      )
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  const withSelection = (fn: (v: string, start: number, end: number) => EditResult) => () => {
    const textarea = textareaRef.current
    if (!textarea) return
    applyEdit(textarea, onChange, fn(value, textarea.selectionStart, textarea.selectionEnd))
  }

  const applyImageSize = (size: 'small' | 'medium' | 'large' | 'original') => {
    const textarea = textareaRef.current
    if (!textarea) return
    const result = setImageSize(value, textarea.selectionStart, textarea.selectionEnd, size)
    if (!result) {
      toast.error('Put your cursor on the image line first')
      return
    }
    applyEdit(textarea, onChange, result)
  }

  return (
    <div className="flex items-center gap-0.5 rounded-t-lg border border-b-0 border-input bg-muted/30 p-1">
      <ToolbarButton label="Bold" onClick={withSelection((v, s, e) => wrapSelection(v, s, e, '**', 'bold text'))}>
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" onClick={withSelection((v, s, e) => wrapSelection(v, s, e, '*', 'italic text'))}>
        <Italic className="size-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton label="Header" onClick={withSelection((v, s, e) => insertLinePrefix(v, s, e, '# '))}>
        <Heading1 className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Subheader" onClick={withSelection((v, s, e) => insertLinePrefix(v, s, e, '## '))}>
        <Heading2 className="size-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton label="Bulleted list" onClick={withSelection((v, s, e) => insertLinePrefix(v, s, e, '- '))}>
        <List className="size-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton label="Inline code" onClick={withSelection((v, s, e) => wrapSelection(v, s, e, '`', 'code'))}>
        <Code className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Code block" onClick={withSelection(insertCodeBlock)}>
        <SquareCode className="size-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton label="Insert image" onClick={() => fileInputRef.current?.click()} disabled={upload.isPending}>
        {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Image className="size-4" />}
      </ToolbarButton>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Image size" />}>
              <Scaling className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => applyImageSize('small')}>Small</DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyImageSize('medium')}>Medium</DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyImageSize('large')}>Large</DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyImageSize('original')}>Original size</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent>Resize the image on the current line</TooltipContent>
      </Tooltip>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload.mutate(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button type="button" variant="ghost" size="icon-sm" onClick={onClick} disabled={disabled} aria-label={label} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
