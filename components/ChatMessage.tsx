import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

import { SourceCitations, type Source } from "./SourceCitations"

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
  sources?: Source[]
}

type Props = {
  message: ChatMessage
}

export function ChatMessageBubble({ message }: Props) {
  const isUser = message.role === "user"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "flex w-full flex-col gap-2",
        isUser ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "max-w-xl whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm shadow-sm",
          isUser
            ? "bg-primary text-slate-900"
            : "bg-[#1f2633] text-foreground",
        )}
      >
        {message.content.trim() || "…"}
      </div>
      <span className="text-xs text-zinc-500">
        {new Date(message.createdAt).toLocaleTimeString("ru-RU")}
      </span>

      {message.role === "assistant" && message.sources?.length ? (
        <SourceCitations sources={message.sources} />
      ) : null}
    </motion.div>
  )
}

