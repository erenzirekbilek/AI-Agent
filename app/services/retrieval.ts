import { embedText } from './embedding.js';
import { qdrant, COLLECTION_NAME } from '../db/qdrant.js';
import type { ChunkSource } from '@repo/types';

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
    limit: topK * 2,
    with_payload: true,
  });

  return results
    .filter((r) => r.score && r.score >= 0.5)
    .slice(0, topK)
    .map((r) => ({
      documentId: (r.payload as Record<string, unknown>)?.documentId as string ?? '',
      documentName: (r.payload as Record<string, unknown>)?.documentName as string ?? '',
      chunkIndex: (r.payload as Record<string, unknown>)?.chunkIndex as number ?? 0,
      content: (r.payload as Record<string, unknown>)?.content as string ?? '',
      score: r.score ?? 0,
    }));
}

export function toChunkSources(chunks: RetrievedChunk[]): ChunkSource[] {
  return chunks.map((c) => ({
    documentId: c.documentId,
    documentName: c.documentName,
    chunkIndex: c.chunkIndex,
    score: c.score,
    excerpt: c.content,
  }));
}
