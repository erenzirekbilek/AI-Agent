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
});
