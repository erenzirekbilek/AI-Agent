import { HfInference } from '@huggingface/inference';
import { config } from '../app/config.js';

const hf = new HfInference(config.HUGGINGFACE_API_KEY);
const MODEL = 'BAAI/bge-m3';

export async function embedText(text: string): Promise<number[]> {
  const result = await hf.featureExtraction({
    model: MODEL,
    inputs: text,
  });
  const embedding = Array.isArray(result[0]) ? (result as number[][])[0] : (result as number[]);
  return embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (const text of texts) {
    embeddings.push(await embedText(text));
  }
  return embeddings;
}
