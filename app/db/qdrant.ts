import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config.js';

export const qdrant = new QdrantClient({
  url: config.QDRANT_URL,
  ...(config.QDRANT_API_KEY ? { apiKey: config.QDRANT_API_KEY } : {}),
});

export const COLLECTION_NAME = 'documents';
export const VECTOR_SIZE = 384; // Xenova/bge-small-en-v1.5

export async function ensureCollection(): Promise<void> {
  const collections = await qdrant.getCollections();
  const col = collections.collections.find(c => c.name === COLLECTION_NAME);
  const requiredSize = VECTOR_SIZE;

  if (!col) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: requiredSize,
        distance: 'Cosine',
      },
    });
    console.log(`✅ Qdrant collection '${COLLECTION_NAME}' (${requiredSize}dim) oluşturuldu`);
    return;
  }

  const currentSize = (col as any).config?.params?.vectors?.size;
  if (currentSize && currentSize !== requiredSize) {
    console.warn(`⚠️ Qdrant collection '${COLLECTION_NAME}' (${currentSize}dim) eski, ${requiredSize}dim olarak yeniden oluşturuluyor...`);
    await qdrant.deleteCollection(COLLECTION_NAME);
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: { size: requiredSize, distance: 'Cosine' },
    });
    console.log(`✅ Qdrant collection '${COLLECTION_NAME}' (${requiredSize}dim) yeniden oluşturuldu`);
  }
}
