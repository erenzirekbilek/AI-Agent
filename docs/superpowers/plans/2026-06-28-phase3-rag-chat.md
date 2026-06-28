# RAG App — Phase 3: RAG Pipeline + Chat UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retrieval-Augmented Generation pipeline (Qdrant search → Groq streaming), tam işlevli Chat UI ve Documents UI, güvenlik middleware ve geliştirici tooling.

**Architecture:** Kullanıcı mesajı → embed et → Qdrant'ta top-5 chunk bul → Groq'a sistem prompt + context + mesaj gönder → SSE stream → frontend'de token token göster. Supabase'e conversation ve message kayıtları tutulur. Frontend TanStack Query ile API state yönetir, streaming için custom hook kullanır.

**Tech Stack:** helmet, express-rate-limit, Husky, lint-staged, @tanstack/react-query, groq-sdk (mevcut), EventSource/fetch SSE

---

## File Map

| Dosya | Sorumluluk |
|-------|-----------|
| `app/main.ts` | helmet + rate-limit middleware ekle |
| `app/services/retrieval.ts` | Query embed et → Qdrant search → RetrievedChunk[] |
| `app/routes/chat.ts` | POST /api/chat — SSE streaming endpoint |
| `frontend/src/app/providers.tsx` | QueryClientProvider wrapper (client component) |
| `frontend/src/app/layout.tsx` | Providers'ı ekle |
| `frontend/src/lib/api.ts` | fetch wrapper — documents CRUD + chat stream |
| `frontend/src/hooks/useChat.ts` | Streaming chat state hook |
| `frontend/src/components/MessageList.tsx` | Mesaj listesi (user + assistant + sources) |
| `frontend/src/components/ChatInput.tsx` | Textarea + gönder butonu |
| `frontend/src/components/UploadZone.tsx` | Drag-drop dosya yükleme |
| `frontend/src/components/DocumentList.tsx` | Doküman listesi + silme |
| `frontend/src/app/chat/page.tsx` | Chat sayfası (refactor) |
| `frontend/src/app/documents/page.tsx` | Documents sayfası (refactor) |

---

### Task 1: Security Middleware (helmet + rate-limit)

**Files:**
- Modify: `app/main.ts`
- Modify: `app/package.json`

- [ ] **Step 1: Paketleri ekle**

`app/package.json` dependencies'e:
```json
"helmet": "^7.1.0",
"express-rate-limit": "^7.3.0"
```

```bash
cd app && npm install
```

- [ ] **Step 2: app/main.ts'i güncelle**

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { ensureCollection } from './db/qdrant.js';
import documentsRouter from './routes/documents.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/documents', documentsRouter);

ensureCollection().catch(console.error);

app.listen(config.PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${config.PORT}`);
});

export default app;
```

- [ ] **Step 3: Typecheck**

```bash
cd app && npx tsc --noEmit
```

Beklenen: hata yok.

- [ ] **Step 4: Commit**

```bash
git add app/main.ts app/package.json app/package-lock.json
git commit -m "feat: add helmet + rate-limit security middleware"
```

---

### Task 2: Husky + lint-staged

**Files:**
- Modify: `package.json` (root)
- Create: `.husky/pre-commit`
- Create: `.lintstagedrc.json`

- [ ] **Step 1: Paketleri kök package.json'a ekle**

```bash
npm install --save-dev husky lint-staged
npx husky init
```

- [ ] **Step 2: .husky/pre-commit dosyasını yaz**

`npx husky init` otomatik oluşturur. İçeriğini şununla değiştir:

```bash
npx lint-staged
```

- [ ] **Step 3: .lintstagedrc.json oluştur (kök)**

```json
{
  "app/**/*.{ts,tsx}": ["npx tsc --noEmit -p app/tsconfig.json"],
  "frontend/**/*.{ts,tsx}": ["npx tsc --noEmit -p frontend/tsconfig.json"]
}
```

- [ ] **Step 4: Test et**

```bash
git add .lintstagedrc.json .husky/pre-commit
git commit -m "chore: add Husky + lint-staged pre-commit hooks"
```

Commit sırasında lint-staged çalışmalı ve hata vermemeli.

---

### Task 3: Retrieval Service

**Files:**
- Create: `app/services/retrieval.ts`
- Modify: `tests/test_retrieval.ts`

- [ ] **Step 1: Failing test yaz**

`tests/test_retrieval.ts` dosyasına ekle:

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock embedding ve qdrant — gerçek API çağrısı yapmayız
vi.mock('../app/services/embedding.js', () => ({
  embedText: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
}));

vi.mock('../app/db/qdrant.js', () => ({
  qdrant: {
    search: vi.fn().mockResolvedValue([
      {
        score: 0.92,
        payload: {
          documentId: 'doc-1',
          documentName: 'test.pdf',
          chunkIndex: 0,
          content: 'Test içerik',
        },
      },
    ]),
  },
  COLLECTION_NAME: 'documents',
}));

describe('retrieveChunks', () => {
  it('query için top-k chunk döner', async () => {
    const { retrieveChunks } = await import('../app/services/retrieval.js');
    const results = await retrieveChunks('test sorgu', 1);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      documentId: 'doc-1',
      documentName: 'test.pdf',
      chunkIndex: 0,
      content: 'Test içerik',
      score: 0.92,
    });
  });
});
```

- [ ] **Step 2: Test'in fail ettiğini doğrula**

```bash
cd app && npx vitest run ../tests/test_retrieval.ts
```

Beklenen: FAIL — "retrieveChunks is not a function"

- [ ] **Step 3: app/services/retrieval.ts yaz**

```typescript
import { embedText } from './embedding.js';
import { qdrant, COLLECTION_NAME } from '../db/qdrant.js';

export type RetrievedChunk = {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  score: number;
};

export async function retrieveChunks(query: string, topK = 5): Promise<RetrievedChunk[]> {
  const vector = await embedText(query);
  const results = await qdrant.search(COLLECTION_NAME, {
    vector,
    limit: topK,
    with_payload: true,
  });

  return results.map(r => ({
    documentId: r.payload!['documentId'] as string,
    documentName: r.payload!['documentName'] as string,
    chunkIndex: r.payload!['chunkIndex'] as number,
    content: r.payload!['content'] as string,
    score: r.score,
  }));
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

```bash
cd app && npx vitest run ../tests/test_retrieval.ts
```

Beklenen: PASS (5 test — 4 chunker + 1 retrieval)

- [ ] **Step 5: Commit**

```bash
git add app/services/retrieval.ts tests/test_retrieval.ts
git commit -m "feat: retrieval service — embed query + Qdrant top-k search"
```

---

### Task 4: Groq Streaming Chat Endpoint

**Files:**
- Create: `app/routes/chat.ts`
- Modify: `app/main.ts`

- [ ] **Step 1: app/routes/chat.ts yaz**

```typescript
import { Router } from 'express';
import Groq from 'groq-sdk';
import { config } from '../config.js';
import { retrieveChunks } from '../services/retrieval.js';
import { supabase } from '../db/supabase.js';
import type { ChatRequest } from '@repo/types';

const router = Router();
const groq = new Groq({ apiKey: config.GROQ_API_KEY });

const MODEL = 'llama-3.1-8b-instant';

// POST /api/chat
router.post('/', async (req, res) => {
  const { message, conversationId } = req.body as ChatRequest;

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Mesaj gerekli' });
  }

  const userId = (req as any).auth?.userId ?? 'anonymous';

  try {
    // Conversation bul veya oluştur
    let convId = conversationId;
    if (!convId) {
      const { data, error } = await supabase
        .from('conversations')
        .insert({ user_id: userId, title: message.slice(0, 60) })
        .select('id')
        .single();
      if (error || !data) throw new Error(`Conversation oluşturulamadı: ${error?.message}`);
      convId = data.id;
    }

    // Kullanıcı mesajını kaydet
    await supabase.from('messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message,
    });

    // RAG: ilgili chunk'ları getir
    const chunks = await retrieveChunks(message, 5);
    const context = chunks.map(c =>
      `[${c.documentName} — bölüm ${c.chunkIndex + 1}]\n${c.content}`
    ).join('\n\n---\n\n');

    const systemPrompt = context
      ? `Sen şirket içi dokümanları bilen bir asistansın. Aşağıdaki bağlamı kullanarak soruyu yanıtla. Bağlamda olmayan bilgiler için "Bu konuda dokümanlarımda bilgi bulamadım" de.\n\nBağlam:\n${context}`
      : `Sen şirket içi dokümanları bilen bir asistansın. Şu an ilgili doküman bulunamadı, genel bilginle yardımcı olmaya çalış.`;

    // SSE başlat
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // conversationId'yi ilk event olarak gönder
    res.write(`data: ${JSON.stringify({ conversationId: convId })}\n\n`);

    // Groq stream
    const stream = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      stream: true,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content ?? '';
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    // Kaynaklarla birlikte assistant mesajını kaydet
    const sources = chunks.map(c => ({
      documentId: c.documentId,
      documentName: c.documentName,
      chunkIndex: c.chunkIndex,
      score: c.score,
      excerpt: c.content.slice(0, 200),
    }));

    await supabase.from('messages').insert({
      conversation_id: convId,
      role: 'assistant',
      content: fullResponse,
      sources,
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: (err as Error).message });
    } else {
      res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
      res.end();
    }
  }
});

// GET /api/chat/conversations
router.get('/conversations', async (req, res) => {
  const userId = (req as any).auth?.userId ?? 'anonymous';
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/chat/conversations/:id/messages
router.get('/conversations/:id/messages', async (req, res) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
```

- [ ] **Step 2: app/main.ts'e chat router ekle**

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { ensureCollection } from './db/qdrant.js';
import documentsRouter from './routes/documents.js';
import chatRouter from './routes/chat.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/documents', documentsRouter);
app.use('/api/chat', chatRouter);

ensureCollection().catch(console.error);

app.listen(config.PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${config.PORT}`);
});

export default app;
```

- [ ] **Step 3: Typecheck**

```bash
cd app && npx tsc --noEmit
```

Beklenen: hata yok.

- [ ] **Step 4: Commit**

```bash
git add app/routes/chat.ts app/main.ts
git commit -m "feat: Groq streaming chat endpoint with RAG context (SSE)"
```

---

### Task 5: TanStack Query Setup + API Client

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/lib/query-client.ts`
- Create: `frontend/src/app/providers.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Create: `frontend/src/lib/api.ts`

- [ ] **Step 1: @tanstack/react-query ekle**

`frontend/package.json` dependencies'e:
```json
"@tanstack/react-query": "^5.45.0"
```

```bash
cd frontend && npm install
```

- [ ] **Step 2: frontend/src/lib/query-client.ts oluştur**

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});
```

- [ ] **Step 3: frontend/src/app/providers.tsx oluştur**

```typescript
'use client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: frontend/src/app/layout.tsx güncelle**

```typescript
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from './providers';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Şirket Doküman Asistanı',
  description: 'Şirket içi dokümanlarınızda AI destekli arama',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="tr">
        <body>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 5: frontend/src/lib/api.ts oluştur**

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function fetchDocuments() {
  const res = await fetch(`${API_URL}/api/documents`);
  if (!res.ok) throw new Error('Dokümanlar alınamadı');
  return res.json();
}

export async function deleteDocument(id: string) {
  const res = await fetch(`${API_URL}/api/documents/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Doküman silinemedi');
}

export async function uploadDocument(file: File): Promise<{ document: { id: string; name: string; chunkCount: number } }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/api/documents/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Yükleme başarısız');
  }
  return res.json();
}

export async function fetchConversations() {
  const res = await fetch(`${API_URL}/api/chat/conversations`);
  if (!res.ok) throw new Error('Sohbetler alınamadı');
  return res.json();
}

export async function fetchMessages(conversationId: string) {
  const res = await fetch(`${API_URL}/api/chat/conversations/${conversationId}/messages`);
  if (!res.ok) throw new Error('Mesajlar alınamadı');
  return res.json();
}

export function streamChat(
  message: string,
  conversationId: string | undefined,
  onToken: (token: string) => void,
  onConversationId: (id: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversationId }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        onError('Sunucu hatası');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { onDone(); return; }
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) { onError(parsed.error); return; }
            if (parsed.conversationId) onConversationId(parsed.conversationId);
            if (parsed.content) onToken(parsed.content);
          } catch {}
        }
      }
      onDone();
    } catch (err: any) {
      if (err.name !== 'AbortError') onError(err.message);
    }
  })();

  return () => controller.abort();
}
```

- [ ] **Step 6: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Beklenen: hata yok.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/ frontend/src/app/providers.tsx frontend/src/app/layout.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: TanStack Query setup + API client with streaming chat"
```

---

### Task 6: Documents UI

**Files:**
- Create: `frontend/src/components/UploadZone.tsx`
- Create: `frontend/src/components/DocumentList.tsx`
- Modify: `frontend/src/app/documents/page.tsx`

- [ ] **Step 1: frontend/src/components/UploadZone.tsx yaz**

```typescript
'use client';
import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { uploadDocument } from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';

export function UploadZone() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  async function upload(file: File) {
    setUploading(true);
    setError('');
    try {
      await uploadDocument(file);
      qc.invalidateQueries({ queryKey: ['documents'] });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = '';
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      style={{
        border: `2px dashed ${dragging ? '#6366f1' : '#2a2a2a'}`,
        borderRadius: 12, padding: '48px 24px', textAlign: 'center',
        marginBottom: 32, cursor: uploading ? 'wait' : 'pointer',
        transition: 'border-color 0.2s', background: dragging ? '#1a1a2e' : 'transparent',
      }}
    >
      <input ref={inputRef} type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }} onChange={onChange} />
      <div style={{ fontSize: 32, marginBottom: 12 }}>{uploading ? '⏳' : '📄'}</div>
      <p style={{ color: '#aaa', fontSize: 14, margin: 0 }}>
        {uploading ? 'Yükleniyor...' : 'Dosyaları buraya sürükleyin veya tıklayın'}
      </p>
      <p style={{ color: '#555', fontSize: 12, margin: '6px 0 0' }}>PDF, DOCX, TXT · Maks 50MB</p>
      {error && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: frontend/src/components/DocumentList.tsx yaz**

```typescript
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchDocuments, deleteDocument } from '../lib/api';

export function DocumentList() {
  const qc = useQueryClient();
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: fetchDocuments,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  if (isLoading) return <p style={{ color: '#555', textAlign: 'center' }}>Yükleniyor...</p>;
  if (!docs.length) return <p style={{ color: '#333', textAlign: 'center', padding: '40px 0' }}>Henüz yüklü doküman yok</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {docs.map((doc: any) => (
        <div key={doc.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: '#1a1a1a', borderRadius: 10,
          border: '1px solid #2a2a2a',
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{doc.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#555' }}>
              {doc.chunk_count} chunk · {(doc.size_bytes / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            onClick={() => deleteMutation.mutate(doc.id)}
            disabled={deleteMutation.isPending}
            style={{
              background: 'transparent', border: '1px solid #3a2020', borderRadius: 6,
              color: '#ef4444', fontSize: 12, padding: '6px 12px', cursor: 'pointer',
            }}
          >
            Sil
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: frontend/src/app/documents/page.tsx yaz**

```typescript
'use client';
import { UserButton } from '@clerk/nextjs';
import { UploadZone } from '../../components/UploadZone';
import { DocumentList } from '../../components/DocumentList';

export default function DocumentsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: '1px solid #1e1e1e',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>✦</div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Şirket Asistanı</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/chat" style={{ color: '#888', fontSize: 14, textDecoration: 'none' }}>Sohbet</a>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </header>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 6px' }}>Dokümanlar</h1>
          <p style={{ color: '#555', fontSize: 14, margin: 0 }}>PDF, DOCX ve TXT dosyalarını yükleyin</p>
        </div>
        <UploadZone />
        <DocumentList />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Beklenen: hata yok.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/UploadZone.tsx frontend/src/components/DocumentList.tsx frontend/src/app/documents/page.tsx
git commit -m "feat: documents UI — drag-drop upload, list, delete with TanStack Query"
```

---

### Task 7: Chat UI

**Files:**
- Create: `frontend/src/hooks/useChat.ts`
- Create: `frontend/src/components/MessageList.tsx`
- Create: `frontend/src/components/ChatInput.tsx`
- Modify: `frontend/src/app/chat/page.tsx`

- [ ] **Step 1: frontend/src/hooks/useChat.ts yaz**

```typescript
'use client';
import { useState, useCallback, useRef } from 'react';
import { streamChat } from '../lib/api';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { documentName: string; excerpt: string; score: number }[];
};

export function useChat(initialConversationId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [streaming, setStreaming] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || streaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '' };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    cancelRef.current = streamChat(
      text,
      conversationId,
      (token) => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: m.content + token } : m
        ));
      },
      (id) => setConversationId(id),
      () => setStreaming(false),
      (err) => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: `Hata: ${err}` } : m
        ));
        setStreaming(false);
      },
    );
  }, [conversationId, streaming]);

  const cancel = useCallback(() => {
    cancelRef.current?.();
    setStreaming(false);
  }, []);

  return { messages, streaming, sendMessage, cancel, conversationId };
}
```

- [ ] **Step 2: frontend/src/components/MessageList.tsx yaz**

```typescript
'use client';
import { Message } from '../hooks/useChat';

export function MessageList({ messages, streaming }: { messages: Message[]; streaming: boolean }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {messages.map((msg) => (
        <div key={msg.id} style={{
          display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
        }}>
          <div style={{
            maxWidth: '75%', padding: '12px 16px', borderRadius: 12,
            background: msg.role === 'user'
              ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
              : '#1a1a1a',
            border: msg.role === 'assistant' ? '1px solid #2a2a2a' : 'none',
            fontSize: 14, lineHeight: 1.6, color: '#fff',
            whiteSpace: 'pre-wrap',
          }}>
            {msg.content || (streaming && msg.role === 'assistant' ? '▋' : '')}
            {msg.sources && msg.sources.length > 0 && (
              <div style={{ marginTop: 12, borderTop: '1px solid #333', paddingTop: 10 }}>
                <p style={{ fontSize: 11, color: '#666', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kaynaklar</p>
                {msg.sources.map((s, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
                      📄 {s.documentName} · <span style={{ color: '#555' }}>{Math.round(s.score * 100)}% eşleşme</span>
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#555', fontStyle: 'italic' }}>
                      "{s.excerpt.slice(0, 100)}..."
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: frontend/src/components/ChatInput.tsx yaz**

```typescript
'use client';
import { useState, KeyboardEvent } from 'react';

type Props = {
  onSend: (text: string) => void;
  streaming: boolean;
  onCancel: () => void;
};

export function ChatInput({ onSend, streaming, onCancel }: Props) {
  const [text, setText] = useState('');

  function submit() {
    if (!text.trim() || streaming) return;
    onSend(text.trim());
    setText('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div style={{ padding: '16px 24px', borderTop: '1px solid #1e1e1e' }}>
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-end',
        background: '#1a1a1a', borderRadius: 12, padding: '12px 16px',
        border: '1px solid #2a2a2a',
      }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Bir şeyler sorun... (Enter ile gönder)"
          rows={1}
          disabled={streaming}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#fff', fontSize: 14, resize: 'none', fontFamily: 'inherit',
            opacity: streaming ? 0.5 : 1,
          }}
        />
        {streaming ? (
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #444',
              background: 'transparent', color: '#aaa', fontSize: 13, cursor: 'pointer',
            }}
          >
            Durdur
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!text.trim()}
            style={{
              padding: '8px 16px', borderRadius: 8,
              background: text.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#2a2a2a',
              border: 'none', color: text.trim() ? '#fff' : '#555',
              fontSize: 13, fontWeight: 500, cursor: text.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }}
          >
            Gönder
          </button>
        )}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 11, color: '#333', textAlign: 'center' }}>
        Enter ile gönder · Shift+Enter yeni satır
      </p>
    </div>
  );
}
```

- [ ] **Step 4: frontend/src/app/chat/page.tsx yaz**

```typescript
'use client';
import { useState } from 'react';
import { UserButton } from '@clerk/nextjs';
import { useChat } from '../../hooks/useChat';
import { MessageList } from '../../components/MessageList';
import { ChatInput } from '../../components/ChatInput';

const EXAMPLE_QUESTIONS = [
  'İzin politikası nedir?',
  'Onboarding süreci nasıl işler?',
  'Teknik mimari belgesi var mı?',
];

export default function ChatPage() {
  const { messages, streaming, sendMessage, cancel } = useChat();

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#fff', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: '1px solid #1e1e1e', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>✦</div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Şirket Asistanı</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/documents" style={{ color: '#888', fontSize: 14, textDecoration: 'none' }}>Dokümanlar</a>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </header>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside style={{
          width: 240, borderRight: '1px solid #1e1e1e', padding: '16px 12px',
          display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
        }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none', color: '#fff', fontSize: 14, fontWeight: 500,
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            + Yeni Sohbet
          </button>
        </aside>

        {/* Chat */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {messages.length === 0 ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
              }}>✦</div>
              <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Nasıl yardımcı olabilirim?</h1>
              <p style={{ color: '#555', fontSize: 14, margin: 0 }}>Şirket dokümanlarınız hakkında soru sorun</p>
              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {EXAMPLE_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    style={{
                      padding: '8px 16px', borderRadius: 20,
                      background: '#1a1a1a', border: '1px solid #2a2a2a',
                      color: '#aaa', fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <MessageList messages={messages} streaming={streaming} />
          )}
          <ChatInput onSend={sendMessage} streaming={streaming} onCancel={cancel} />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Beklenen: hata yok.

- [ ] **Step 6: Frontend'i başlat ve test et**

```bash
cd frontend && npm run dev
```

Tarayıcıda `http://localhost:3000/chat` aç:
- Boş durum ekranı ve örnek sorular görünmeli
- Backend çalışıyorsa bir soru yaz → streaming yanıt gelmeli
- `/documents` sayfasında dosya yükleme çalışmalı

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useChat.ts frontend/src/components/MessageList.tsx frontend/src/components/ChatInput.tsx frontend/src/app/chat/page.tsx
git commit -m "feat: chat UI with streaming, message list, sources display"
```

---

## Self-Review

**Spec Coverage:**
- ✅ helmet + rate-limit (Task 1)
- ✅ Husky + lint-staged (Task 2)
- ✅ Retrieval service — embed query + Qdrant top-k (Task 3)
- ✅ Groq streaming chat endpoint (Task 4)
- ✅ Conversation + message persistence (Task 4)
- ✅ TanStack Query setup (Task 5)
- ✅ API client with streaming (Task 5)
- ✅ Documents UI — upload, list, delete (Task 6)
- ✅ Chat UI — streaming, sources, örnek sorular (Task 7)

**Placeholder scan:** Yok.

**Type consistency:**
- `Message` (useChat.ts) → `MessageList` props → tutarlı
- `streamChat` imzası (api.ts) → `useChat.ts` çağrısı → tutarlı
- `RetrievedChunk` (retrieval.ts) → `chat.ts` sources mapping → tutarlı
- `ChatRequest` (@repo/types) → `chat.ts` req.body → tutarlı
