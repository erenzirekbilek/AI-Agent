# RAG App — Phase 2: Document Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doküman yükleme, parse etme, chunk'lara bölme, HuggingFace ile embed etme ve Qdrant'a kaydetme pipeline'ını kurmak; Supabase tablolarını migration ile oluşturmak.

**Architecture:** Upload endpoint → Multer ile dosya al → pdf-parse/mammoth ile metin çıkar → 512 token chunk'lara böl → HuggingFace Inference API ile embed et → Qdrant'a vektör + payload kaydet → Supabase'e metadata kaydet. Otomatik sync için `scripts/sync.ts` klasör izler.

**Tech Stack:** Express + Multer, pdf-parse, mammoth, @huggingface/inference, @qdrant/js-client-rest, @supabase/supabase-js, vitest

---

## File Map

| Dosya | Sorumluluk |
|-------|-----------|
| `scripts/migrate.ts` | Supabase tablolarını oluştur |
| `app/db/supabase.ts` | Supabase client singleton |
| `app/db/qdrant.ts` | Qdrant client + collection setup |
| `services/chunker.ts` | Metni 512 token chunk'lara böl |
| `services/embedding.ts` | HuggingFace BAAI/bge-m3 ile embed et |
| `services/document_processor.ts` | PDF/DOCX/TXT → metin → chunk → embed → kaydet |
| `app/routes/documents.ts` | POST /documents/upload, GET /documents, DELETE /documents/:id |
| `app/main.ts` | documents route'unu ekle |
| `scripts/sync.ts` | data/raw/ klasörünü izle, yeni dosyaları otomatik işle |
| `tests/test_retrieval.ts` | chunker + embedding unit testleri |

---

### Task 1: Supabase Client + Migration

**Files:**
- Create: `app/db/supabase.ts`
- Modify: `scripts/migrate.ts`

- [ ] **Step 1: app/db/ dizinini oluştur**

```bash
mkdir app/db
```

- [ ] **Step 2: app/db/supabase.ts yaz**

```typescript
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
```

- [ ] **Step 3: scripts/migrate.ts yaz**

Bu script Supabase'de gerekli tabloları oluşturur. Supabase'in SQL editörüne de kopyalanabilir.

```typescript
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const sql = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    uploaded_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Yeni Sohbet',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks(document_id);
  CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations(user_id);
`;

const { error } = await supabase.rpc('exec_sql', { sql }).catch(() => ({ error: null }));

// Supabase RPC olmadan doğrudan REST üzerinden çalıştır
const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_SERVICE_KEY!,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY!}`,
  },
  body: JSON.stringify({ sql }),
});

if (!res.ok) {
  // Supabase SQL Editor'e kopyalanacak SQL'i göster
  console.log('⚠️  Otomatik migration başarısız. Aşağıdaki SQL\'i Supabase SQL Editor\'e yapıştırın:\n');
  console.log(sql);
} else {
  console.log('✅ Migration tamamlandı');
}
```

- [ ] **Step 4: Migration çalıştır**

```bash
npx tsx scripts/migrate.ts
```

Eğer otomatik çalışmazsa: Supabase dashboard → SQL Editor → yukarıdaki SQL'i yapıştır → Run.

- [ ] **Step 5: Commit**

```bash
git add app/db/supabase.ts scripts/migrate.ts
git commit -m "feat: Supabase client + DB migration (documents, chunks, conversations, messages)"
```

---

### Task 2: Qdrant Client + Collection Setup

**Files:**
- Create: `app/db/qdrant.ts`

- [ ] **Step 1: app/db/qdrant.ts yaz**

BAAI/bge-m3 modeli 1024 boyutlu vektör üretir.

```typescript
import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config.js';

export const qdrant = new QdrantClient({
  url: config.QDRANT_URL,
  ...(config.QDRANT_API_KEY ? { apiKey: config.QDRANT_API_KEY } : {}),
});

export const COLLECTION_NAME = 'documents';
export const VECTOR_SIZE = 1024; // BAAI/bge-m3

export async function ensureCollection(): Promise<void> {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: 'Cosine',
      },
    });
    console.log(`✅ Qdrant collection '${COLLECTION_NAME}' oluşturuldu`);
  }
}
```

- [ ] **Step 2: app/main.ts'e collection setup ekle**

Mevcut `app/main.ts` dosyasını oku, sonra güncelle:

```typescript
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { ensureCollection } from './db/qdrant.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

ensureCollection().catch(console.error);

app.listen(config.PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${config.PORT}`);
});

export default app;
```

- [ ] **Step 3: Qdrant ayaktayken test et**

```bash
docker compose up qdrant -d
npx tsx -e "import('./app/db/qdrant.js').then(m => m.ensureCollection())"
```

Beklenen: `✅ Qdrant collection 'documents' oluşturuldu`

- [ ] **Step 4: Commit**

```bash
git add app/db/qdrant.ts app/main.ts
git commit -m "feat: Qdrant client + auto collection setup (BAAI/bge-m3, 1024 dim)"
```

---

### Task 3: Chunker Service

**Files:**
- Create: `services/chunker.ts`
- Create: `tests/test_retrieval.ts`

- [ ] **Step 1: Failing test yaz**

```typescript
// tests/test_retrieval.ts
import { describe, it, expect } from 'vitest';
import { chunkText } from '../services/chunker.js';

describe('chunkText', () => {
  it('kısa metni tek chunk yapar', () => {
    const result = chunkText('Merhaba dünya.', 512, 50);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Merhaba dünya.');
  });

  it('uzun metni overlap ile böler', () => {
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`);
    const text = words.join(' ');
    const result = chunkText(text, 512, 50);
    expect(result.length).toBeGreaterThan(1);
    // Her chunk max 512 kelime
    for (const chunk of result) {
      expect(chunk.split(' ').length).toBeLessThanOrEqual(512);
    }
    // Overlap: ikinci chunk'ın başı birinci chunk'ın sonuyla örtüşmeli
    const firstChunkWords = result[0].split(' ');
    const secondChunkWords = result[1].split(' ');
    const lastWordsOfFirst = firstChunkWords.slice(-50);
    const firstWordsOfSecond = secondChunkWords.slice(0, 50);
    expect(firstWordsOfSecond).toEqual(lastWordsOfFirst);
  });

  it('boş metni boş array döner', () => {
    expect(chunkText('', 512, 50)).toEqual([]);
  });
});
```

- [ ] **Step 2: Test'in fail ettiğini doğrula**

```bash
cd app && npx vitest run ../tests/test_retrieval.ts
```

Beklenen: FAIL — "chunkText is not a function"

- [ ] **Step 3: services/chunker.ts yaz**

```typescript
export function chunkText(text: string, maxTokens: number, overlap: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Kelime bazlı yaklaşım (token ≈ kelime, basit ve etkili)
  const words = trimmed.split(/\s+/);
  if (words.length <= maxTokens) return [trimmed];

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + maxTokens, words.length);
    chunks.push(words.slice(start, end).join(' '));
    if (end === words.length) break;
    start += maxTokens - overlap;
  }

  return chunks;
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

```bash
cd app && npx vitest run ../tests/test_retrieval.ts
```

Beklenen: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add services/chunker.ts tests/test_retrieval.ts
git commit -m "feat: text chunker with overlap (512 tokens, 50 overlap)"
```

---

### Task 4: Embedding Service

**Files:**
- Create: `services/embedding.ts`

- [ ] **Step 1: @huggingface/inference paketini ekle**

`app/package.json` dependencies'e ekle:

```json
"@huggingface/inference": "^2.8.0"
```

Sonra:

```bash
cd app && npm install
```

- [ ] **Step 2: services/embedding.ts yaz**

```typescript
import { HfInference } from '@huggingface/inference';
import { config } from '../app/config.js';

const hf = new HfInference(config.HUGGINGFACE_API_KEY);
const MODEL = 'BAAI/bge-m3';

export async function embedText(text: string): Promise<number[]> {
  const result = await hf.featureExtraction({
    model: MODEL,
    inputs: text,
  });
  // result: number[] | number[][]
  const embedding = Array.isArray(result[0]) ? (result as number[][])[0] : (result as number[]);
  return embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  // HuggingFace rate limit için sıralı gönder
  const embeddings: number[][] = [];
  for (const text of texts) {
    embeddings.push(await embedText(text));
  }
  return embeddings;
}
```

- [ ] **Step 3: Commit**

```bash
git add services/embedding.ts app/package.json
git commit -m "feat: HuggingFace embedding service (BAAI/bge-m3)"
```

---

### Task 5: Document Processor

**Files:**
- Create: `services/document_processor.ts`

- [ ] **Step 1: services/document_processor.ts yaz**

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { v4 as uuidv4 } from 'uuid';
import { chunkText } from './chunker.js';
import { embedBatch } from './embedding.js';
import { supabase } from '../app/db/supabase.js';
import { qdrant, COLLECTION_NAME } from '../app/db/qdrant.js';
import type { Document } from '@repo/types';

export type ProcessResult = {
  document: Document;
  chunksCreated: number;
};

async function extractText(filePath: string, mimeType: string): Promise<string> {
  const buffer = await fs.readFile(filePath);

  if (mimeType === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // text/plain
  return buffer.toString('utf-8');
}

export async function processDocument(
  filePath: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
  uploadedBy: string
): Promise<ProcessResult> {
  const text = await extractText(filePath, mimeType);
  const chunks = chunkText(text, 512, 50);

  // Supabase'e doküman kaydı
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      name: fileName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      chunk_count: chunks.length,
      uploaded_by: uploadedBy,
    })
    .select()
    .single();

  if (docError || !doc) throw new Error(`Doküman kaydedilemedi: ${docError?.message}`);

  // Chunk'ları embed et
  const embeddings = await embedBatch(chunks);

  // Qdrant'a vektör kaydet
  const points = chunks.map((content, i) => ({
    id: uuidv4(),
    vector: embeddings[i],
    payload: {
      documentId: doc.id,
      documentName: fileName,
      chunkIndex: i,
      content,
    },
  }));

  await qdrant.upsert(COLLECTION_NAME, { points });

  // Supabase'e chunk metadata kaydet
  const chunkRows = chunks.map((content, i) => ({
    document_id: doc.id,
    content,
    chunk_index: i,
  }));

  await supabase.from('chunks').insert(chunkRows);

  return {
    document: {
      id: doc.id,
      name: doc.name,
      mimeType: doc.mime_type as Document['mimeType'],
      sizeBytes: doc.size_bytes,
      chunkCount: chunks.length,
      uploadedBy: doc.uploaded_by,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    },
    chunksCreated: chunks.length,
  };
}
```

- [ ] **Step 2: uuid paketini ekle**

`app/package.json` dependencies'e:
```json
"uuid": "^9.0.0"
```
devDependencies'e:
```json
"@types/uuid": "^9.0.0"
```

```bash
cd app && npm install
```

- [ ] **Step 3: Commit**

```bash
git add services/document_processor.ts app/package.json
git commit -m "feat: document processor — parse PDF/DOCX/TXT, chunk, embed, store"
```

---

### Task 6: Upload API Endpoint

**Files:**
- Create: `app/routes/documents.ts`
- Modify: `app/main.ts`

- [ ] **Step 1: app/routes/documents.ts yaz**

```typescript
import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { processDocument } from '../../services/document_processor.js';
import { supabase } from '../db/supabase.js';
import { qdrant, COLLECTION_NAME } from '../db/qdrant.js';

const router = Router();

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const upload = multer({
  dest: 'data/uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece PDF, DOCX ve TXT dosyaları desteklenir'));
    }
  },
});

// POST /api/documents/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Dosya gerekli' });
  }

  try {
    const result = await processDocument(
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      (req as any).auth?.userId ?? 'anonymous'
    );

    // Geçici upload dosyasını sil
    await fs.unlink(req.file.path).catch(() => {});

    res.status(201).json(result);
  } catch (err) {
    await fs.unlink(req.file.path).catch(() => {});
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/documents
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/documents/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  // Qdrant'tan chunk'ları sil
  await qdrant.delete(COLLECTION_NAME, {
    filter: {
      must: [{ key: 'documentId', match: { value: id } }],
    },
  });

  // Supabase'den sil (chunks CASCADE ile silinir)
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  res.status(204).send();
});

export default router;
```

- [ ] **Step 2: app/main.ts'e route'u ekle**

```typescript
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { ensureCollection } from './db/qdrant.js';
import documentsRouter from './routes/documents.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
app.use(express.json());

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

- [ ] **Step 3: data/uploads/ dizinini oluştur**

```bash
mkdir -p data/uploads
echo "" > data/uploads/.gitkeep
```

- [ ] **Step 4: Backend'i başlat ve upload test et**

```bash
# .env dosyasının dolu olduğundan emin ol, sonra:
cd app && npm run dev
```

Yeni terminalde:
```bash
curl -X POST http://localhost:3001/api/documents/upload \
  -F "file=@/path/to/test.pdf"
```

Beklenen:
```json
{
  "document": { "id": "...", "name": "test.pdf", ... },
  "chunksCreated": 5
}
```

- [ ] **Step 5: Commit**

```bash
git add app/routes/documents.ts app/main.ts data/uploads/.gitkeep
git commit -m "feat: document upload/list/delete API endpoints"
```

---

### Task 7: Auto Sync Script

**Files:**
- Modify: `scripts/sync.ts`

- [ ] **Step 1: chokidar paketini kök package.json'a ekle**

`package.json` (kök) devDependencies:
```json
"chokidar": "^3.6.0",
"@types/node": "^20.0.0"
```

```bash
npm install
```

- [ ] **Step 2: scripts/sync.ts yaz**

```typescript
import chokidar from 'chokidar';
import path from 'node:path';
import fs from 'node:fs/promises';
import 'dotenv/config';
import { processDocument } from '../services/document_processor.js';
import { ensureCollection } from '../app/db/qdrant.js';

const WATCH_DIR = path.resolve('data/raw');
const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
};

await ensureCollection();
console.log(`👀 İzleniyor: ${WATCH_DIR}`);

chokidar.watch(WATCH_DIR, { ignoreInitial: false }).on('add', async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_MAP[ext];
  if (!mimeType) return;

  console.log(`📄 Yeni dosya: ${filePath}`);

  try {
    const stat = await fs.stat(filePath);
    const result = await processDocument(
      filePath,
      path.basename(filePath),
      mimeType,
      stat.size,
      'sync-bot'
    );
    console.log(`✅ ${result.document.name} — ${result.chunksCreated} chunk oluşturuldu`);
  } catch (err) {
    console.error(`❌ İşlenemedi: ${filePath}`, (err as Error).message);
  }
});
```

- [ ] **Step 3: Test et**

```bash
npx tsx scripts/sync.ts &
cp /path/to/test.txt data/raw/
```

Beklenen: `✅ test.txt — N chunk oluşturuldu`

- [ ] **Step 4: Commit**

```bash
git add scripts/sync.ts package.json
git commit -m "feat: auto sync — watch data/raw/ and process new documents"
```

---

## Self-Review

**Spec Coverage:**
- ✅ Manuel upload (POST /api/documents/upload)
- ✅ Otomatik sync (scripts/sync.ts — data/raw/ izler)
- ✅ PDF parse (pdf-parse)
- ✅ DOCX parse (mammoth)
- ✅ TXT parse (Buffer.toString)
- ✅ Chunk'lara bölme (512 token, 50 overlap)
- ✅ HuggingFace BAAI/bge-m3 embedding
- ✅ Qdrant'a kayıt (vektör + payload)
- ✅ Supabase'e metadata (documents + chunks tabloları)
- ✅ Doküman listeleme (GET /api/documents)
- ✅ Doküman silme (DELETE /api/documents/:id) — Qdrant + Supabase

**Eksik (Phase 3'e bırakılan):**
- RAG pipeline (retrieval + reranking)
- Groq streaming chat endpoint
- Chat UI bileşenleri

**Placeholder scan:** Yok.

**Type consistency:**
- `processDocument` → `ProcessResult` → `Document` (@repo/types ile uyumlu)
- `qdrant.upsert` payload'ı → `documentId`, `documentName`, `chunkIndex`, `content` — Phase 3 retrieval'da aynı key isimler kullanılacak
