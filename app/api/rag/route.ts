import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

import { generateEmbedding } from "@/lib/embeddings"
import { supabase } from "@/lib/supabase"

type RagRequest = {
  question: string
  document_source?: string
}

type RetrievedDocument = {
  content: string
  embedding: number[]
  metadata: Record<string, any>
  similarity: number
}

const SOURCE_MARKER = "__SOURCES__"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RagRequest
    const { question, document_source } = body || {}

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid question" },
        { status: 400 },
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not set" },
        { status: 500 },
      )
    }

    // OpenAI is used only for embeddings; Claude Sonnet 4.5 generates the answer.
    const questionEmbedding = await generateEmbedding(question)

    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: questionEmbedding,
      match_threshold: 0.7,
      match_count: 3,
    })

    if (error) {
      return NextResponse.json(
        { error: `Supabase match_documents failed: ${error.message}` },
        { status: 500 },
      )
    }

    let matches = (data as RetrievedDocument[]) || []

    if (document_source) {
      matches = matches.filter(
        (doc) => doc.metadata?.source === document_source,
      )
    }

    if (!matches.length) {
      return NextResponse.json(
        { error: "No relevant chunks found. Try rephrasing or uploading." },
        { status: 404 },
      )
    }

    const context = matches
      .map((doc, idx) => `${doc.content}\n---`)
      .join("\n")

    const contextPrompt = `Context from documents:\n\n${context}\nQuestion: ${question}\n\nAnswer based ONLY on the context above. Be specific and cite which information came from which part of the context.`

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const claudeStream = await anthropic.messages.stream({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      system:
        "You are a helpful assistant. Answer questions based ONLY on the provided context. If the context doesn't contain enough information, say \"I don't have that information in the available documents.\"",
      messages: [
        {
          role: "user",
          content: contextPrompt,
        },
      ],
    })

    const sourcesPayload = matches.map((m) => ({
      content: m.content,
      metadata: m.metadata,
      similarity: m.similarity ?? 0,
    }))

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of claudeStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta?.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }

          controller.enqueue(
            encoder.encode(`\n${SOURCE_MARKER}${JSON.stringify(sourcesPayload)}`),
          )
        } catch (streamError) {
          controller.error(streamError)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected RAG error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

