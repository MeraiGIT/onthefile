import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

export type Source = {
  content: string
  metadata: Record<string, any>
  similarity: number
}

type Props = {
  sources: Source[]
}

function similarityColor(score: number) {
  const percent = Math.round(score * 100)
  if (percent > 85) return "text-emerald-400"
  if (percent >= 70) return "text-amber-400"
  return "text-red-400"
}

export function SourceCitations({ sources }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const orderedSources = useMemo(
    () => sources?.filter(Boolean) ?? [],
    [sources],
  )

  if (!orderedSources.length) return null

  return (
    <div className="mt-3 space-y-2">
      <AnimatePresence>
        {orderedSources.map((source, idx) => {
          const percent = Math.round(source.similarity * 100)
          const isOpen = openIndex === idx
          const meta = source.metadata || {}
          const header = meta.source || "Неизвестный источник"
          const chunkIndex = meta.chunk_index ?? meta.index ?? idx

          return (
            <motion.div
              key={`${meta.source}-${chunkIndex}-${idx}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="border-[#1f2633] bg-[#1f2633] p-3 text-sm shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">
                        📄 {header} (Фрагмент {chunkIndex})
                      </span>
                      <Badge
                        variant="secondary"
                        className={`${similarityColor(percent)} bg-transparent`}
                      >
                        {percent}% совпадение
                      </Badge>
                    </div>
                    {meta.total_chunks !== undefined && (
                      <p className="text-xs text-foreground/60">
                        Часть из {meta.total_chunks} фрагментов
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-foreground/60">
                    {isOpen ? "Скрыть" : "Показать"}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                        {source.content}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

