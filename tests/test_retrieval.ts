import { describe, it, expect, vi } from 'vitest';
import { chunkText } from '../app/services/chunker.js';

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
    for (const chunk of result) {
      expect(chunk.split(' ').length).toBeLessThanOrEqual(512);
    }
    const firstChunkWords = result[0].split(' ');
    const secondChunkWords = result[1].split(' ');
    const lastWordsOfFirst = firstChunkWords.slice(-50);
    const firstWordsOfSecond = secondChunkWords.slice(0, 50);
    expect(firstWordsOfSecond).toEqual(lastWordsOfFirst);
  });

  it('boş metni boş array döner', () => {
    expect(chunkText('', 512, 50)).toEqual([]);
  });

  it('overlap >= maxTokens durumunda hata fırlatır', () => {
    expect(() => chunkText('some text here and more', 5, 5)).toThrow();
    expect(() => chunkText('some text here and more', 3, 10)).toThrow();
  });
});

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
