"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatInput } from "@/components/ChatInput"
import {
  ChatMessageBubble,
  type ChatMessage as ChatMessageType,
} from "@/components/ChatMessage"
import type { Source } from "@/components/SourceCitations"
import { cn } from "@/lib/utils"

type DocumentSummary = {
  source: string
  chunk_count: number
  created_at: string
}

const SOURCE_MARKER = "__SOURCES__"

export default function ChatPage() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [input, setInput] = useState("")
  const [selectedSource, setSelectedSource] = useState("all")
  const [isStreaming, setIsStreaming] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingDocs, setLoadingDocs] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const fetchDocuments = async () => {
      setLoadingDocs(true)
      const res = await fetch("/api/documents")
      if (res.ok) {
        const data = (await res.json()) as DocumentSummary[]
        setDocuments(data)
      }
      setLoadingDocs(false)
    }
    fetchDocuments()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStreaming])

  const hasDocuments = useMemo(() => documents.length > 0, [documents])

  const handleClear = () => {
    setMessages([])
    setError(null)
  }

  const updateMessage = (id: string, update: Partial<ChatMessageType>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...update } : msg)),
    )
  }

  const handleSend = async () => {
    if (!input.trim()) return
    if (!hasDocuments) {
      setError("Сначала загрузите документы, чтобы начать чат.")
      return
    }

    setError(null)

    const userMessage: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      createdAt: new Date().toISOString(),
    }

    const assistantId = `assistant-${Date.now()}`
    const assistantMessage: ChatMessageType = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      sources: [],
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setInput("")
    setIsStreaming(true)
    setStatus("Поиск документов...")

    try {
      const res = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage.content,
          document_source: selectedSource !== "all" ? selectedSource : undefined,
        }),
      })

      if (!res.ok || !res.body) {
        const message = res.ok
          ? "Нет тела ответа"
          : ((await res.json().catch(() => ({}))) as { error?: string }).error ??
            "Ошибка генерации ответа. Пожалуйста, попробуйте снова."
        updateMessage(assistantId, {
          content: message,
        })
        setError(message)
        return
      }

      setStatus("Генерация ответа...")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ""
      let done = false

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        const chunkValue = decoder.decode(value || new Uint8Array(), {
          stream: !done,
        })
        fullText += chunkValue

        const markerIndex = fullText.indexOf(SOURCE_MARKER)
        const visibleText =
          markerIndex === -1 ? fullText : fullText.slice(0, markerIndex)

        updateMessage(assistantId, { content: visibleText })
      }

      const markerIndex = fullText.indexOf(SOURCE_MARKER)
      if (markerIndex !== -1) {
        const answer = fullText.slice(0, markerIndex)
        const sourcesJson = fullText.slice(markerIndex + SOURCE_MARKER.length)
        const parsedSources = JSON.parse(sourcesJson || "[]") as Source[]
        updateMessage(assistantId, {
          content: answer.trim(),
          sources: parsedSources,
        })
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Ошибка генерации ответа."
      updateMessage(assistantId, { content: message })
      setError(message)
    } finally {
      setIsStreaming(false)
      setStatus(null)
    }
  }

  const statusText = useMemo(() => {
    if (status) return status
    if (isStreaming) return "Claude печатает..."
    return undefined
  }, [isStreaming, status])

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-[#0b0d11] via-[#0f1218] to-[#0b0d11] text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-[#141a26] ring-1 ring-primary/50 shadow-lg shadow-primary/20">
              <Image
                src="/Logo Emphasizing Sleek Design.svg"
                alt="On the File logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary">
              On the File
            </p>
            <h1 className="display text-2xl font-semibold tracking-tight">
              Чат с документами
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Claude Sonnet 4.5 отвечает на основе ваших загруженных документов.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              asChild
              className="bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:scale-[1.01] hover:bg-primary/90"
            >
              <Link href="/">Загрузить ещё файлы</Link>
            </Button>
            <Select
              value={selectedSource}
              onValueChange={(val) => setSelectedSource(val)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Выберите документ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все документы</SelectItem>
                {documents.map((doc) => (
                  <SelectItem key={doc.source} value={doc.source}>
                    {doc.source} ({doc.chunk_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={!messages.length}
            >
              Очистить чат
            </Button>
          </div>
        </header>

        {!loadingDocs && !documents.length ? (
          <Card className="flex flex-1 flex-col items-center justify-center gap-3 border border-dashed border-[#2a3242] bg-[#0b0f17] p-8 text-center shadow-xl shadow-black/20">
            <p className="text-lg font-semibold text-foreground">
              Сначала загрузите документы
            </p>
            <p className="text-sm text-foreground/70">
              Для чата нужны проиндексированные документы. Добавьте их, чтобы начать.
            </p>
            <Link href="/" className="text-primary hover:underline">
              Перейти к загрузке
            </Link>
          </Card>
        ) : (
          <Card className="flex min-h-[60vh] flex-1 flex-col border-[#1f2633] bg-[#0f141f] p-4 shadow-xl shadow-black/20">
            <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
              <span>
                {loadingDocs
                  ? "Загрузка документов..."
                  : `Доступно ${documents.length} источников документов`}
              </span>
              {statusText && (
                <Badge variant="secondary" className="text-xs">
                  {statusText}
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1 rounded-lg border border-[#1f2633] bg-[#0b0f17] p-4">
              <div className="flex flex-col gap-4">
                {messages.map((msg) => (
                  <ChatMessageBubble key={msg.id} message={msg} />
                ))}
                {isStreaming && (
                  <div className="text-sm text-zinc-500">Claude печатает…</div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {error && (
              <div className="mt-3 text-sm text-red-500">
                {error} <Button variant="link" onClick={handleSend}>Повторить</Button>
              </div>
            )}

            <div className="mt-4">
              <ChatInput
                value={input}
                onChange={setInput}
                onSend={handleSend}
                disabled={isStreaming}
                loading={isStreaming}
                statusText={statusText ?? undefined}
              />
            </div>
          </Card>
        )}
      </div>
    </main>
  )
}

