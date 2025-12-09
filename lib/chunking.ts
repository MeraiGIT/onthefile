export type Chunk = {
  text: string
  index: number
}

export function chunkText(
  text: string,
  chunkSize = 500,
  overlap = 50,
): Chunk[] {
  if (chunkSize <= 0) throw new Error("chunkSize must be positive")
  if (overlap < 0) throw new Error("overlap cannot be negative")
  if (overlap >= chunkSize)
    throw new Error("overlap must be smaller than chunkSize")

  const chunks: Chunk[] = []
  let position = 0
  let index = 0

  while (position < text.length) {
    const chunkText = text.slice(position, position + chunkSize)
    chunks.push({ text: chunkText, index })

    position += chunkSize - overlap
    index += 1
  }

  return chunks
}

