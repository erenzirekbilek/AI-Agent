# Production RAG App — Design Spec
**Date:** 2026-06-28

## Overview
Şirket içi doküman arama ve soru-cevap sistemi. Çalışanlar şirket dokümanlarına (PDF, DOCX, TXT) karşı doğal dilde soru sorabilir; sistem ilgili chunk'ları bulup streaming yanıt üretir.

---

## Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Backend | Node.js + Express + TypeScript |
| Frontend | Next.js 14 + TypeScript (App Router) |
| Auth | Clerk |
| Vector DB | Qdrant |
| Ana DB | Supabase (PostgreSQL) |
| LLM | Groq (LLaMA 3) |
| Embeddings | HuggingFace (`BAAI/bge-m3` — Türkçe dahil çok dilli) |
| Streaming | SSE (Server-Sent Events) |
| Monorepo | Turborepo |

---

## Klasör Yapısı

Mevcut yapı korunur, `.py` → `.ts` olur.

```
production-ai-app/
├── app/                   Express ana uygulama
│   ├── main.ts            Sunucu başlangıcı
│   ├── config.ts          Env değişkenleri
│   ├── models.ts          Supabase tablo tipleri
│   └── Dockerfile
├── components/
│   ├── hybrid_retriever.ts   Qdrant vektör + keyword arama
│   └── reranker.ts           Chunk yeniden sıralama
├── services/
│   ├── rag_pipeline.ts       Ana RAG akışı
│   ├── semantic_cache.ts     Benzer sorulara cache
│   ├── conversation.ts       Konuşma geçmişi
│   ├── query_rewriter.ts     Soruyu optimize et
│   └── query_router.ts       Hangi kaynağa gideceğine karar ver
├── prompts/
│   ├── templates.ts          Prompt şablonları
│   └── registry.ts           Prompt yönetimi
├── agents/
│   ├── document_grader.ts    Chunk kalitesini değerlendir
│   ├── query_decomposer.ts   Karmaşık soruları parçala
│   ├── adaptive_router.ts    Dinamik yönlendirme
│   └── tools/
│       ├── vector_search.ts
│       ├── web_search.ts
│       └── code_search.ts
├── security/
│   ├── input_guard.ts        Prompt injection koruması
│   ├── content_filter.ts     İçerik filtreleme
│   └── output_filter.ts      Çıktı güvenliği
├── observability/
│   ├── tracer.ts             İstek takibi
│   ├── feedback.ts           Kullanıcı geri bildirimi
│   └── cost_tracker.ts       Token/API maliyet takibi
├── evaluation/
│   ├── golden_dataset.json
│   ├── offline_eval.ts
│   └── online_monitor.ts
├── scripts/
│   ├── seed.ts               Test verisi yükle
│   ├── migrate.ts            DB migration
│   └── healthcheck.ts        Servis sağlık kontrolü
├── frontend/                 Next.js 14 App Router
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/       Clerk login/signup
│   │   │   ├── chat/         Ana chat arayüzü
│   │   │   ├── documents/    Upload + doküman listesi
│   │   │   └── admin/        Kullanıcı yönetimi
│   │   ├── components/
│   │   │   ├── chat/         ChatWindow, MessageBubble, StreamingText
│   │   │   ├── documents/    UploadZone, DocumentList
│   │   │   └── ui/           Shared UI bileşenleri
│   │   └── lib/
│   │       └── api.ts        Backend'e fetch helper'ları
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── packages/
│   └── types/                Shared TypeScript interface'leri
├── tests/
│   ├── test_retrieval.ts
│   ├── test_cache.ts
│   └── test_routing.ts
├── docker-compose.yml        Qdrant + backend + frontend
├── turbo.json
└── pyproject.toml → package.json (kök)
```

---

## Veri Akışı

### Doküman Yükleme
```
Upload (manual) veya File Sync (otomatik)
  → Backend: PDF/DOCX/TXT parse
  → Chunk'lara böl (512 token, 50 overlap)
  → HuggingFace BAAI/bge-m3 ile embedding
  → Qdrant'a kaydet (vector + payload)
  → Supabase'e metadata (dosya adı, tarih, chunk sayısı, yükleyen)
```

### Soru-Cevap (Streaming)
```
Kullanıcı soru yazar
  → Clerk token doğrulama
  → query_rewriter: soruyu optimize et (Groq)
  → query_decomposer: karmaşık ise parçala
  → HuggingFace ile soru embedding
  → Qdrant hybrid search (vektör + keyword)
  → reranker: en iyi chunk'ları seç
  → document_grader: chunk kalite kontrolü
  → Groq'a (context + soru) gönder
  → SSE stream → Frontend'de kelime kelime görünür
  → cost_tracker: token sayısını kaydet
```

---

## API Endpoints

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/api/chat` | SSE streaming chat |
| POST | `/api/documents/upload` | Doküman yükle |
| GET | `/api/documents` | Doküman listesi |
| DELETE | `/api/documents/:id` | Doküman sil |
| GET | `/api/health` | Servis sağlık kontrolü |

---

## Güvenlik
- Tüm endpoint'ler Clerk JWT doğrulaması gerektirir
- `input_guard.ts`: prompt injection, jailbreak tespiti
- `output_filter.ts`: hassas bilgi sızıntısı kontrolü
- Dosya upload: sadece PDF/DOCX/TXT, max 50MB

---

## Environment Variables

```env
# Backend
GROQ_API_KEY=
HUGGINGFACE_API_KEY=
QDRANT_URL=
QDRANT_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
CLERK_SECRET_KEY=

# Frontend
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
NEXT_PUBLIC_API_URL=
```
