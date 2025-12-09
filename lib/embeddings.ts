import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const MAX_RETRIES = 3

export async function generateEmbedding(text: string): Promise<number[]> {
  let attempt = 0
  let delayMs = 250

  while (attempt < MAX_RETRIES) {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text,
      })

      const embedding = response.data[0]?.embedding
      if (!embedding) {
        throw new Error("No embedding returned from OpenAI")
      }
      return embedding
    } catch (error) {
      attempt += 1
      if (attempt >= MAX_RETRIES) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      delayMs *= 2
    }
  }

  throw new Error("Failed to generate embedding")
}

