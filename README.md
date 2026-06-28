# AI Agent — RAG Chat Application

A production-grade Retrieval-Augmented Generation (RAG) chat application. Upload documents, ask questions, and get answers grounded in your content — with source citations and streaming responses.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript |
| Backend | Node.js + Express, TypeScript |
| LLM | Groq (`llama-3.3-70b-versatile`) |
| Embeddings | `@xenova/transformers` — `bge-small-en-v1.5` (local, no API key needed) |
| Vector DB | Qdrant |
| Database | Supabase (PostgreSQL) |
| Auth | Clerk |
| Monorepo | Turborepo |

## Project Structure

```
├── app/                  # Express backend
│   ├── routes/           # chat.ts, documents.ts
│   ├── services/         # rag.ts, embedding.ts, retrieval.ts, chunker.ts
│   ├── db/               # qdrant.ts, supabase.ts, repositories.ts
│   └── middleware/       # auth.ts (Clerk JWT verification)
├── frontend/             # Next.js frontend
│   └── src/
│       ├── app/          # App Router pages
│       ├── components/   # UI components
│       └── lib/          # api.ts (streaming chat client)
├── packages/types/       # Shared TypeScript types
├── scripts/              # migrate.mjs (DB schema), sync.ts (file watcher)
├── data/
│   ├── raw/              # Drop documents here — auto-synced
│   └── uploads/          # Processed uploads
└── docker-compose.yml    # Qdrant + backend + frontend
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker (for Qdrant)
- A [Supabase](https://supabase.com) project
- A [Clerk](https://clerk.com) application
- A [Groq](https://console.groq.com) API key

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
# Backend
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

GROQ_API_KEY=             # groq.com
QDRANT_URL=http://localhost:6333

SUPABASE_URL=             # your Supabase project URL
SUPABASE_SERVICE_KEY=     # service role key (not anon key)
DATABASE_URL=             # postgres connection string (for migrations)

CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
CLERK_JWT_KEY=

# Frontend
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/chat
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/chat
```

### 3. Start Qdrant

```bash
docker compose up qdrant -d
```

### 4. Run database migrations

```bash
node scripts/migrate.mjs
```

### 5. Start development servers

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Backend health: http://localhost:3001/health

## Docker (full stack)

```bash
docker compose up --build
```

## Key API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Service health check (Qdrant, Supabase, Groq) |
| `POST` | `/api/chat` | Streaming RAG chat (SSE) |
| `GET` | `/api/documents` | List uploaded documents |
| `POST` | `/api/documents` | Upload a document (PDF, DOCX, TXT) |
| `DELETE` | `/api/documents/:id` | Delete a document and its vectors |

All `/api/*` routes require a Clerk JWT (`Authorization: Bearer <token>`).

## Document Ingestion

Drop files into `data/raw/` — the sync watcher (`scripts/sync.ts`) picks them up automatically in development. Documents are chunked, embedded locally, and indexed into Qdrant.

Supported formats: **PDF**, **DOCX**, **TXT**

## Scripts

```bash
npm run dev          # Start all services (Turborepo)
npm run build        # Build all packages
npm run test         # Run Vitest tests
npm run typecheck    # TypeScript check across all packages
node scripts/migrate.mjs   # Apply DB schema to Supabase
```

## Open Issues

See the [GitHub Issues](https://github.com/erenzirekbilek/AI-Agent/issues) for known bugs and planned improvements, including:

- [#2](https://github.com/erenzirekbilek/AI-Agent/issues/2) TypeScript test suite
- [#3](https://github.com/erenzirekbilek/AI-Agent/issues/3) Embedding model cold start
- [#4](https://github.com/erenzirekbilek/AI-Agent/issues/4) Qdrant dimension mismatch handling
- [#5](https://github.com/erenzirekbilek/AI-Agent/issues/5) Observability (cost tracking, tracing, feedback)
