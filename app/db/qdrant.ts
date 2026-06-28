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
