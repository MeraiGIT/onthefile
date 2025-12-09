import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  loading?: boolean
  statusText?: string
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  loading,
  statusText,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 44)}px`
  }, [value])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      if (!disabled && !loading && value.trim()) {
        onSend()
      }
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#1f2633] bg-[#0f141f] p-3 shadow-xl shadow-black/20">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Задайте вопрос о ваших документах..."
        className="min-h-[44px] max-h-[44px] resize-none border-0 bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-foreground/50 shadow-none focus-visible:ring-0 focus-visible:ring-primary/50"
        disabled={disabled || loading}
      />
      <Button
        onClick={onSend}
        disabled={disabled || loading || !value.trim()}
        className="min-w-[100px] shrink-0 bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90"
      >
        {loading ? "Отправка..." : "Отправить"}
      </Button>
    </div>
  )
}

