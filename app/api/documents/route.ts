import { NextResponse } from "next/server"

import { supabase } from "@/lib/supabase"

type DocumentSummary = {
  source: string
  chunk_count: number
  created_at: string
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("documents")
      .select("metadata, created_at")

    if (error) {
      throw new Error(error.message)
    }

    const summaries: Record<string, DocumentSummary> = {}

    for (const row of data ?? []) {
      const source = (row as any).metadata?.source
      if (!source) continue

      if (!summaries[source]) {
        summaries[source] = {
          source,
          chunk_count: 0,
          created_at: (row as any).created_at,
        }
      }

      summaries[source].chunk_count += 1
    }

    return NextResponse.json(Object.values(summaries))
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch documents"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

type DeleteRequest = {
  source: string
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as DeleteRequest
    if (!body?.source) {
      return NextResponse.json(
        { error: "Missing source to delete" },
        { status: 400 },
      )
    }

    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("metadata->>source", body.source)

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete document"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

