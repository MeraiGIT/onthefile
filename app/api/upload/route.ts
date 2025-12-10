import { NextResponse } from "next/server"

import { chunkText } from "@/lib/chunking"
import { generateEmbedding } from "@/lib/embeddings"
import { supabase } from "@/lib/supabase"

type UploadRequest = {
  content: string
  filename: string
}

async function extractTextFromPDF(file: File): Promise<string> {
  try {
    // Use pdf-extraction - works with buffers directly in Node.js
    const pdfExtraction = require("pdf-extraction")
    
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    const data = await pdfExtraction(buffer)
    
    if (!data || !data.text || !data.text.trim()) {
      throw new Error("PDF appears to be empty or contains no extractable text.")
    }
    
    return data.text.trim()
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("password") || error.message.includes("encrypted")) {
        throw new Error("This PDF is password-protected and cannot be processed.")
      }
      if (error.message.includes("corrupt") || error.message.includes("invalid")) {
        throw new Error("This PDF file appears to be corrupted or invalid.")
      }
      if (error.message.includes("empty") || error.message.includes("no extractable text")) {
        throw error
      }
    }
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

export async function POST(req: Request) {
  const startTime = performance.now()

  try {
    let content: string
    let filename: string

    const contentType = req.headers.get("content-type")?.toLowerCase() ?? ""

    // Handle multipart/form-data (PDF upload) or JSON (text upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const file = formData.get("file")
      const filenameParam = formData.get("filename")

      // If file exists in FormData, treat as PDF upload
      if (file && file instanceof File) {
        filename = (filenameParam as string) || file.name

        if (!filename || typeof filename !== "string") {
          return NextResponse.json(
            { error: "Invalid filename." },
            { status: 400 },
          )
        }

        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          return NextResponse.json(
            { error: "File too large. Limit is 10MB." },
            { status: 400 },
          )
        }

        // Check if it's a PDF
        const isPdf = file.type === "application/pdf" || filename.endsWith(".pdf")
        
        if (!isPdf) {
          return NextResponse.json(
            { error: "Only PDF files are supported via file upload. Use text paste for .txt files." },
            { status: 400 },
          )
        }

        // Extract text from PDF
        content = await extractTextFromPDF(file)

        if (!content || content.trim().length === 0) {
          return NextResponse.json(
            { error: "PDF appears to be empty or contains no extractable text." },
            { status: 400 },
          )
        }
      } else {
        // FormData but no file - invalid request
        return NextResponse.json(
          { error: "No file provided in FormData." },
          { status: 400 },
        )
      }
    } else {
      // Handle JSON request (existing .txt behavior)
      const body = (await req.json()) as UploadRequest
      content = body.content
      filename = body.filename

      if (!content || typeof content !== "string") {
        return NextResponse.json(
          { error: "Invalid content. Expecting non-empty string." },
          { status: 400 },
        )
      }

      if (!filename || typeof filename !== "string") {
        return NextResponse.json(
          { error: "Invalid filename. Expecting non-empty string." },
          { status: 400 },
        )
      }

      if (content.length > 50_000) {
        return NextResponse.json(
          { error: "File too large. Limit is 50,000 characters." },
          { status: 400 },
        )
      }
    }

    const chunks = chunkText(content)

    const embeddings = await Promise.all(
      chunks.map(async (chunk) => {
        const embedding = await generateEmbedding(chunk.text)
        return { ...chunk, embedding }
      }),
    )

    const rows = embeddings.map(({ text, index, embedding }) => ({
      content: text,
      embedding,
      metadata: {
        source: filename,
        chunk_index: index,
        total_chunks: chunks.length,
      },
    }))

    const { error } = await supabase.from("documents").insert(rows)
    if (error) {
      throw new Error(error.message)
    }

    const timeTaken = (performance.now() - startTime) / 1000

    return NextResponse.json({
      success: true,
      chunks_created: rows.length,
      time_taken: Number(timeTaken.toFixed(2)),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

