# RAG App — Phase 1: Foundation & Template Setup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Node.js + Next.js TypeScript monorepo kurulumu — mevcut klasör yapısı korunarak tüm config dosyaları, bağımlılıklar ve Docker ortamı hazır hale getirilir.

**Architecture:** Turborepo monorepo. Backend Express (app/), Frontend Next.js (frontend/), shared tipler (packages/types/). Mevcut Python dosyaları `.ts` karşılıklarıyla değiştirilir, klasör isimleri değişmez.

**Tech Stack:** Node.js 20, TypeScript 5, Express 4, Next.js 14, Turborepo, Docker Compose, Qdrant, Supabase, Clerk, Groq SDK, HuggingFace Inference API

---

## File Map

| Dosya | Sorumluluk |
|-------|-----------|
| `package.json` (kök) | Turborepo workspace tanımı |
| `turbo.json` | Pipeline tanımları |
| `tsconfig.base.json` | Ortak TS config |
| `app/package.json` | Backend bağımlılıkları |
| `app/tsconfig.json` | Backend TS config |
| `app/main.ts` | Express sunucu başlangıcı |
| `app/config.ts` | Env değişkenleri + doğrulama |
| `app/models.ts` | Supabase tablo tipleri |
| `packages/types/index.ts` | Shared interface'ler |
| `packages/types/package.json` | Types paketi tanımı |
| `frontend/package.json` | Next.js bağımlılıkları |
| `frontend/tsconfig.json` | Frontend TS config |
| `frontend/next.config.ts` | Next.js config |
| `frontend/src/app/layout.tsx` | Root layout + Clerk provider |
| `frontend/src/app/page.tsx` | Redirect → /chat |
| `frontend/src/middleware.ts` | Clerk auth middleware |
| `.env.example` | Tüm env değişkenleri şablonu |
| `docker-compose.yml` | Qdrant + backend + frontend servisleri |
| `app/Dockerfile` | Backend container |
| `frontend/Dockerfile` | Frontend container |
| `scripts/healthcheck.ts` | Tüm servisleri kontrol et |

---

### Task 1: Kök Monorepo Yapısını Kur

**Files:**
- Modify: `package.json` (kök)
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Kök package.json yaz**

```json
{
  "name": "production-ai-app",
  "private": true,
  "workspaces": ["app", "frontend", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  }
}
```

Dosya: `package.json` (kök, mevcut varsa üzerine yaz)

- [ ] **Step 2: turbo.json yaz**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 3: Ortak tsconfig.base.json yaz**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: .env.example yaz**

```env
# Backend
NODE_ENV=development
PORT=3001

GROQ_API_KEY=
HUGGINGFACE_API_KEY=

QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

SUPABASE_URL=
SUPABASE_SERVICE_KEY=

CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=

# Frontend
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/chat
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/chat
```

- [ ] **Step 5: .gitignore yaz**

```gitignore
node_modules/
.env
.env.local
dist/
.next/
*.tsbuildinfo
.turbo/
eval_results/
data/raw/
data/processed/
```

- [ ] **Step 6: Root bağımlılıkları yükle**

```bash
npm install
```

Beklenen: `node_modules/` oluşur, turbo kurulur.

- [ ] **Step 7: Commit**

```bash
git add package.json turbo.json tsconfig.base.json .env.example .gitignore
git commit -m "chore: monorepo foundation — turborepo + root config"
```

---

### Task 2: Shared Types Paketi

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/index.ts`

- [ ] **Step 1: packages/types/package.json yaz**

```json
{
  "name": "@repo/types",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: packages/types/tsconfig.json yaz**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["index.ts"]
}
```

- [ ] **Step 3: packages/types/index.ts yaz**

```typescript
export interface Document {
  id: string;
  name: string;
  mimeType: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' | 'text/plain';
  sizeBytes: number;
  chunkCount: number;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  embedding?: number[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChunkSource[];
  createdAt: string;
}

export interface ChunkSource {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  score: number;
  excerpt: string;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface UploadResponse {
  document: Document;
  chunksCreated: number;
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  services: {
    qdrant: boolean;
    supabase: boolean;
    groq: boolean;
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/
git commit -m "feat: add shared TypeScript types package"
```

---

### Task 3: Backend (Express) Kurulumu

**Files:**
- Create: `app/package.json`
- Create: `app/tsconfig.json`
- Modify: `app/main.ts`
- Modify: `app/config.ts`
- Modify: `app/models.ts`

- [ ] **Step 1: app/package.json yaz**

```json
{
  "name": "@repo/backend",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/types": "*",
    "@clerk/clerk-sdk-node": "^4.0.0",
    "@qdrant/js-client-rest": "^1.9.0",
    "@supabase/supabase-js": "^2.43.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.19.0",
    "groq-sdk": "^0.3.0",
    "multer": "^1.4.5-lts.1",
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.7.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.0.0",
    "@types/pdf-parse": "^1.1.4",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: app/tsconfig.json yaz**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: app/config.ts yaz**

```typescript
import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  GROQ_API_KEY: z.string().min(1),
  HUGGINGFACE_API_KEY: z.string().min(1),
  QDRANT_URL: z.string().url(),
  QDRANT_API_KEY: z.string().optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
```

- [ ] **Step 4: app/models.ts yaz**

```typescript
export type DocumentRow = {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  chunk_count: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
};

export type ChunkRow = {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  created_at: string;
};

export type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: string; // JSON string
  created_at: string;
};
```

- [ ] **Step 5: app/main.ts yaz**

```typescript
import express from 'express';
import cors from 'cors';
import { config } from './config.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(config.PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${config.PORT}`);
});

export default app;
```

- [ ] **Step 6: Backend bağımlılıklarını yükle**

```bash
cd app && npm install
```

- [ ] **Step 7: Typecheck çalıştır**

```bash
cd app && npm run typecheck
```

Beklenen: Hata yok.

- [ ] **Step 8: Commit**

```bash
git add app/
git commit -m "feat: Express backend scaffold with config validation"
```

---

### Task 4: Frontend (Next.js) Kurulumu

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.ts`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/page.tsx`
- Create: `frontend/src/middleware.ts`
- Create: `frontend/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- Create: `frontend/src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- Create: `frontend/src/lib/api.ts`

- [ ] **Step 1: frontend/package.json yaz**

```json
{
  "name": "@repo/frontend",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@clerk/nextjs": "^5.2.0",
    "@repo/types": "*",
    "next": "14.2.4",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: frontend/tsconfig.json yaz**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: frontend/next.config.ts yaz**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/types'],
};

export default nextConfig;
```

- [ ] **Step 4: frontend/src/app/layout.tsx yaz**

```tsx
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Şirket Doküman Asistanı',
  description: 'Şirket içi dokümanlarınızda AI destekli arama',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="tr">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 5: frontend/src/app/page.tsx yaz**

```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/chat');
}
```

- [ ] **Step 6: frontend/src/middleware.ts yaz**

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect();
  }
});

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
};
```

- [ ] **Step 7: Clerk sign-in sayfası yaz**

Dosya: `frontend/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`

```tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
      <SignIn />
    </main>
  );
}
```

- [ ] **Step 8: Clerk sign-up sayfası yaz**

Dosya: `frontend/src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`

```tsx
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
      <SignUp />
    </main>
  );
}
```

- [ ] **Step 9: frontend/src/lib/api.ts yaz**

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export function apiStream(path: string, body: unknown, onChunk: (text: string) => void): () => void {
  const controller = new AbortController();

  (async () => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data !== '[DONE]') onChunk(data);
        }
      }
    }
  })();

  return () => controller.abort();
}
```

- [ ] **Step 10: Frontend bağımlılıklarını yükle**

```bash
cd frontend && npm install
```

- [ ] **Step 11: Typecheck çalıştır**

```bash
cd frontend && npm run typecheck
```

Beklenen: Hata yok.

- [ ] **Step 12: Commit**

```bash
git add frontend/
git commit -m "feat: Next.js 14 frontend scaffold with Clerk auth"
```

---

### Task 5: Docker Compose Kurulumu

**Files:**
- Modify: `docker-compose.yml`
- Modify: `app/Dockerfile`
- Modify: `frontend/Dockerfile`

- [ ] **Step 1: docker-compose.yml yaz**

```yaml
version: '3.8'

services:
  qdrant:
    image: qdrant/qdrant:v1.9.0
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage

  backend:
    build:
      context: .
      dockerfile: app/Dockerfile
    ports:
      - "3001:3001"
    env_file: .env
    depends_on:
      - qdrant
    volumes:
      - ./data:/app/data

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - backend

volumes:
  qdrant_data:
```

- [ ] **Step 2: app/Dockerfile yaz**

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json turbo.json ./
COPY packages/ ./packages/
COPY app/package.json ./app/
RUN npm install

FROM base AS builder
COPY app/ ./app/
RUN cd app && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

- [ ] **Step 3: frontend/Dockerfile yaz**

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json turbo.json ./
COPY packages/ ./packages/
COPY frontend/package.json ./frontend/
RUN npm install

FROM base AS builder
COPY frontend/ ./frontend/
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd frontend && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./.next/static
COPY --from=builder /app/frontend/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 4: Qdrant'ı ayağa kaldır ve test et**

```bash
docker compose up qdrant -d
curl http://localhost:6333/healthz
```

Beklenen: `{"title":"qdrant - vector search engine","version":"..."}`

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml app/Dockerfile frontend/Dockerfile
git commit -m "feat: Docker Compose with Qdrant, backend, frontend"
```

---

### Task 6: Healthcheck Script

**Files:**
- Modify: `scripts/healthcheck.ts`

- [ ] **Step 1: scripts/healthcheck.ts yaz**

```typescript
import 'dotenv/config';

const checks = [
  { name: 'Backend', url: `http://localhost:${process.env.PORT ?? 3001}/health` },
  { name: 'Qdrant', url: `${process.env.QDRANT_URL ?? 'http://localhost:6333'}/healthz` },
];

async function check(name: string, url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const ok = res.ok;
    console.log(`${ok ? '✅' : '❌'} ${name}: ${res.status}`);
    return ok;
  } catch (e) {
    console.log(`❌ ${name}: unreachable`);
    return false;
  }
}

const results = await Promise.all(checks.map(c => check(c.name, c.url)));
process.exit(results.every(Boolean) ? 0 : 1);
```

- [ ] **Step 2: Healthcheck çalıştır (Qdrant ayaktayken)**

```bash
npx tsx scripts/healthcheck.ts
```

Beklenen:
```
✅ Backend: 200
✅ Qdrant: 200
```

- [ ] **Step 3: Commit**

```bash
git add scripts/healthcheck.ts
git commit -m "feat: healthcheck script for all services"
```

---

## Self-Review

**Spec Coverage:**
- ✅ Monorepo (Turborepo) kurulumu
- ✅ Backend Express + TypeScript scaffold
- ✅ Frontend Next.js 14 + TypeScript + Clerk
- ✅ Shared types paketi
- ✅ Docker Compose + Qdrant
- ✅ Environment variables şablonu
- ✅ Healthcheck script

**Eksik (sonraki planlara bırakılan):**
- Document upload + parsing → Phase 2
- Embedding + Qdrant entegrasyonu → Phase 2
- RAG pipeline + Groq streaming → Phase 3
- Chat UI bileşenleri → Phase 4
- Supabase DB migration → Phase 2

**Placeholder scan:** Yok — tüm adımlarda gerçek kod mevcut.

**Type consistency:** `@repo/types` interface'leri Task 2'de tanımlandı, `frontend/src/lib/api.ts` ve `app/models.ts` bunlarla uyumlu.
