# On the File - RAG Document Chat System

A modern, production-ready Retrieval-Augmented Generation (RAG) system that allows you to upload documents (`.txt` and `.pdf`), generate embeddings, and chat with them using Claude Sonnet 4.5. Built with Next.js, Supabase, and OpenAI embeddings.

![Next.js](https://img.shields.io/badge/Next.js-16.0.8-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Database-green?style=flat-square&logo=supabase)

## ✨ Features

- **📄 Multi-Format Document Support**: Upload `.txt` files or `.pdf` documents (up to 10MB)
- **🧠 Intelligent Chunking**: Automatic text chunking with configurable overlap for optimal context retrieval
- **🔍 Vector Search**: OpenAI `text-embedding-ada-002` embeddings stored in Supabase with pgvector
- **💬 AI-Powered Chat**: Chat with your documents using Claude Sonnet 4.5 with source citations
- **📊 Document Management**: View, manage, and delete uploaded documents
- **🎨 Modern UI**: Sleek, dark-themed interface with smooth animations using Framer Motion
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices
- **⚡ Real-time Processing**: Live progress indicators during document processing
- **🔗 Source Citations**: Expandable source citations showing which chunks were used in responses

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Animations**: Framer Motion
- **Database**: Supabase (PostgreSQL with pgvector)
- **Embeddings**: OpenAI `text-embedding-ada-002`
- **LLM**: Anthropic Claude Sonnet 4.5
- **PDF Parsing**: pdf-extraction

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** 20.x or higher
- **npm**, **yarn**, **pnpm**, or **bun**
- **Supabase account** (free tier works)
- **OpenAI API key**
- **Anthropic API key**

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd day4-rag-system
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI API Key (for embeddings)
OPENAI_API_KEY=your_openai_api_key

# Anthropic API Key (for Claude)
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 4. Set Up Supabase Database

#### Create the Documents Table

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for vector similarity search
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create an index for metadata queries
CREATE INDEX IF NOT EXISTS documents_metadata_idx 
ON documents 
USING GIN (metadata);
```

#### Create the Match Documents Function

Create this function for similarity search:

```sql
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 5. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Usage Guide

### Uploading Documents

1. **Navigate to the Home Page** (`/`)
2. **Choose an upload method**:
   - **File Upload**: Drag and drop a `.txt` or `.pdf` file, or click to browse
   - **Text Paste**: Paste text directly into the textarea (up to 50,000 characters)
3. **Click "Process Document"** to start processing
4. **Wait for completion** - you'll see a progress bar and success message
5. **Automatically redirected** to the chat page after successful upload

### Chatting with Documents

1. **Navigate to Chat Page** (`/chat`) or click "Jump to chat" from the upload page
2. **Select a document** (optional) - Use the dropdown to filter by specific document
3. **Ask questions** - Type your question in the chat input
4. **View responses** - Claude Sonnet 4.5 will answer based on your uploaded documents
5. **Check sources** - Expand source citations to see which document chunks were used

### Managing Documents

- **View all documents** on the upload page sidebar
- **Delete documents** by clicking the "Delete" button next to any document
- **Filter in chat** using the document selector dropdown

## 📁 Project Structure

```
day4-rag-system/
├── app/
│   ├── api/
│   │   ├── documents/     # Document list and delete endpoints
│   │   ├── rag/           # RAG chat endpoint with Claude
│   │   └── upload/        # Document upload and processing
│   ├── chat/              # Chat interface page
│   ├── page.tsx           # Document upload page
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── ChatInput.tsx      # Chat input component
│   ├── ChatMessage.tsx   # Message bubble component
│   └── SourceCitations.tsx # Source citation component
├── lib/
│   ├── chunking.ts        # Text chunking utility
│   ├── embeddings.ts      # OpenAI embedding generation
│   ├── supabase.ts        # Supabase client
│   └── utils.ts           # Utility functions
└── public/                # Static assets
```

## 🔌 API Endpoints

### POST `/api/upload`

Upload and process a document.

**Request (JSON for text)**:
```json
{
  "content": "Your text content here",
  "filename": "document.txt"
}
```

**Request (FormData for PDF)**:
- `file`: PDF file (File object)
- `filename`: Filename string

**Response**:
```json
{
  "success": true,
  "chunks_created": 10,
  "time_taken": 3.45
}
```

### GET `/api/documents`

Get list of all uploaded documents.

**Response**:
```json
[
  {
    "source": "document.pdf",
    "chunk_count": 15,
    "created_at": "2024-01-01T12:00:00Z"
  }
]
```

### DELETE `/api/documents`

Delete a document and all its chunks.

**Request**:
```json
{
  "source": "document.pdf"
}
```

### POST `/api/rag`

Chat with documents using RAG.

**Request**:
```json
{
  "question": "What is this document about?",
  "document_source": "document.pdf" // optional
}
```

**Response**: Streaming text response with sources appended.

## 🧪 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Code Style

- TypeScript strict mode enabled
- ESLint with Next.js config
- Prettier formatting (if configured)

## 🚢 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

Make sure to set all required environment variables in your deployment platform:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

## 🔒 Security Notes

- Never commit `.env.local` to version control
- Use Supabase Row Level Security (RLS) for production
- Consider rate limiting for API endpoints
- Validate file sizes and types on both client and server

## 📝 License

This project is private and proprietary.

## 🤝 Contributing

This is a private project. For questions or issues, please contact the maintainer.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Vector database powered by [Supabase](https://supabase.com/)
- AI models from [OpenAI](https://openai.com/) and [Anthropic](https://www.anthropic.com/)

---

**Made with ❤️ using modern web technologies**
