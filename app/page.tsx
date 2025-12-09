"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { chunkText } from "@/lib/chunking"
import Image from "next/image"

type DocumentSummary = {
  source: string
  chunk_count: number
  created_at: string
}

export default function Home() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [rawText, setRawText] = useState("")
  const [filename, setFilename] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)

  const chunksPreview = useMemo(() => {
    if (!rawText) return []
    try {
      return chunkText(rawText)
    } catch {
      return []
    }
  }, [rawText])

  const costEstimate = useMemo(() => {
    const perChunk = 0.0001
    return chunksPreview.length
      ? `~$${(chunksPreview.length * perChunk).toFixed(4)}`
      : "~$0.0000"
  }, [chunksPreview.length])

  useEffect(() => {
    const loadDocuments = async () => {
      setLoadingDocs(true)
      const res = await fetch("/api/documents")
      if (res.ok) {
        const data = (await res.json()) as DocumentSummary[]
        setDocuments(data)
      }
      setLoadingDocs(false)
    }
    loadDocuments()
  }, [])

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleFileSelect = async (file?: File) => {
    if (!file) return

    const isTxt = file.type === "text/plain" || file.name.endsWith(".txt")
    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf")

    if (!isTxt && !isPdf) {
      setError("Поддерживаются только файлы .txt и .pdf.")
      resetFileInput()
      return
    }

    // Check file size (10MB limit for PDFs, 50k chars for txt)
    if (file.size > 10 * 1024 * 1024) {
      setError("Файл слишком большой. Лимит: 10 МБ.")
      resetFileInput()
      return
    }

    setFilename(file.name)
    setError(null)

    if (isTxt) {
      // For .txt files, read text client-side
      const text = await file.text()
      if (text.length > 50_000) {
        setError("Файл слишком большой. Лимит: 50 000 символов.")
        resetFileInput()
        return
      }
      setRawText(text)
      setSelectedFile(null)
    } else if (isPdf) {
      // For PDF files, store the file object to send to API
      setSelectedFile(file)
      setRawText("") // Clear text since PDF will be processed server-side
    }
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    await handleFileSelect(file)
  }

  const simulateProgress = (total: number) => {
    setProgress({ current: 0, total })
    let current = 0

    const interval = setInterval(() => {
      current = Math.min(total, current + 1)
      setProgress({ current, total })
      if (current >= total || !processing) {
        clearInterval(interval)
      }
    }, 200)

    return () => clearInterval(interval)
  }

  const handleUpload = async () => {
    setError(null)
    setSuccessMessage(null)

    const isPdf = selectedFile && (selectedFile.type === "application/pdf" || selectedFile.name.endsWith(".pdf"))
    const hasText = rawText.trim().length > 0

    if (!hasText && !isPdf) {
      setError("Пожалуйста, загрузите файл или вставьте текст.")
      return
    }

    if (!filename) {
      setFilename(isPdf ? "вставленный_текст.pdf" : "вставленный_текст.txt")
    }

    try {
      setProcessing(true)
      const totalChunks = chunksPreview.length || 1
      const stopProgress = simulateProgress(totalChunks)

      const startedAt = performance.now()
      let res: Response

      if (isPdf && selectedFile) {
        // Send PDF file as FormData
        const formData = new FormData()
        formData.append("file", selectedFile)
        formData.append("filename", filename || selectedFile.name)

        res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })
      } else {
        // Send text content as JSON (existing behavior)
        res = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: rawText,
            filename: filename || "pasted_text.txt",
          }),
        })
      }

      stopProgress()

      if (!res.ok) {
        const { error: message } = await res.json()
        throw new Error(message || "Ошибка загрузки")
      }

      const data = await res.json()
      const elapsed = ((performance.now() - startedAt) / 1000).toFixed(1)
      setSuccessMessage(
        `✓ Документ загружен! Создано ${data.chunks_created} фрагментов за ${elapsed}с`,
      )
      setProgress({ current: totalChunks, total: totalChunks })
      setRawText("")
      setFilename("")
      setSelectedFile(null)
      resetFileInput()
      await refreshDocuments()
      router.push("/chat")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Произошла непредвиденная ошибка"
      setError(message)
    } finally {
      setProcessing(false)
    }
  }

  const refreshDocuments = async () => {
    setLoadingDocs(true)
    const res = await fetch("/api/documents")
    if (res.ok) {
      const data = (await res.json()) as DocumentSummary[]
      setDocuments(data)
    }
    setLoadingDocs(false)
  }

  const handleDelete = async (source: string) => {
    await fetch("/api/documents", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source }),
    })
    await refreshDocuments()
  }

  const disabled = processing || (!rawText.trim() && !selectedFile)

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0b0d11] via-[#0f1218] to-[#0b0d11] px-4 py-10 font-sans text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative h-20 w-20 overflow-hidden">
                <Image
                  src="/Logo Emphasizing Sleek Design.svg"
                  alt="On the File logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-primary">
                  On the File
                </p>
                <h1 className="display text-3xl font-semibold tracking-tight">
                  Загрузка документов
                </h1>
              </div>
            </div>
            <div className="flex w-full justify-center md:w-auto">
              <Button
                variant="secondary"
                onClick={() => router.push("/chat")}
                className="w-full max-w-sm justify-center bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-[1.01] hover:bg-primary/90"
              >
                Перейти к чату
              </Button>
            </div>
          </div>
          <p className="text-sm text-zinc-400">
            Загружайте файлы .txt или .pdf или вставляйте текст, генерируйте эмбеддинги и сохраняйте
            их в Supabase для поиска. Минимальная подготовка, мгновенный контекст.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[2fr,1.2fr]">
          <Card className="border-[#1f2633] bg-[#0f141f] p-6 shadow-xl shadow-black/20">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-[#2a3242] bg-[#0b0f17] px-6 py-10 text-center transition hover:border-primary/60 hover:text-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <p className="text-sm font-medium text-foreground/80">
                Перетащите файл .txt или .pdf
              </p>
              <p className="text-xs text-foreground/60">
                или нажмите, чтобы выбрать файл (макс. 10 МБ)
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,text/plain,application/pdf"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
            </div>

            <div className="my-4 text-center text-xs uppercase text-foreground/50">
              ИЛИ
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">
                Вставить текст
              </label>
              <Textarea
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value)
                  setSelectedFile(null) // Clear file selection when typing
                }}
                placeholder="Вставьте до 50 000 символов текста..."
                className="min-h-[220px] resize-none border-[#2a3242] bg-[#0b0f17] text-foreground"
              />
              <div className="flex items-center justify-between text-xs text-foreground/60">
                <span>
                  {filename || "Файл не выбран"}
                  {selectedFile && ` (${(selectedFile.size / 1024).toFixed(1)} КБ)`}
                </span>
                <span>
                  {selectedFile ? "PDF файл" : `${rawText.length} / 50 000 симв.`}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="space-y-1 text-sm text-foreground/70">
                <p>Примерная стоимость: {costEstimate}</p>
                <p>
                  Фрагментов: {chunksPreview.length || 0} • Модель: text-embedding-ada-002
                </p>
              </div>
              <Button disabled={disabled} onClick={handleUpload}>
                {processing ? "Обработка..." : "Обработать документ"}
              </Button>
            </div>

            {progress.total > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-300">
                  <span>
                    Обработка фрагмента {Math.min(progress.current, progress.total)} из{" "}
                    {progress.total}
                  </span>
                  <span>
                    {Math.round(
                      (progress.current / Math.max(progress.total, 1)) * 100,
                    )}
                    %
                  </span>
                </div>
                <Progress
                  value={
                    (progress.current / Math.max(progress.total, 1)) * 100
                  }
                />
              </div>
            )}

            <div className="mt-4 min-h-[24px] text-sm text-foreground">
              {error && (
                <p className="text-red-500">
                  {error}
                </p>
              )}
            </div>

            <AnimatePresence>
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400"
                >
                  {successMessage}
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          <Card className="border-[#1f2633] bg-[#0f141f] p-6 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Загруженные документы</h2>
              <Badge variant="secondary" className="text-xs">
                {documents.length} источников
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              {loadingDocs && <p className="text-sm text-zinc-500">Загрузка...</p>}
              {!loadingDocs && documents.length === 0 && (
                <p className="text-sm text-zinc-500">Пока нет документов.</p>
              )}
              <AnimatePresence>
                {documents.map((doc) => (
                  <motion.div
                    key={doc.source}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                  >
                    <Card className="flex items-center justify-between border-zinc-200 px-4 py-3 shadow-none dark:border-zinc-800">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{doc.source}</p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <Badge variant="outline">{doc.chunk_count} фрагментов</Badge>
                          <span>
                            {new Date(doc.created_at).toLocaleString("ru-RU")}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(doc.source)}
                      >
                        Удалить
                      </Button>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </Card>
        </section>
      </div>
    </main>
  )
}
