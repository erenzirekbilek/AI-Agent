import { pipeline } from '@xenova/transformers';

let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
  }
  return extractor;
}

export async function embedText(text: string): Promise<number[]> {
  const extract = await getExtractor();
  const result = await extract(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const extract = await getExtractor();
  const result = await extract(texts, { pooling: 'mean', normalize: true });
  const arr = Array.from(result.data) as number[];
  const dim = 384;
  const embeddings: number[][] = [];
  for (let i = 0; i < arr.length; i += dim) {
    embeddings.push(arr.slice(i, i + dim));
  }
  return embeddings;
}
