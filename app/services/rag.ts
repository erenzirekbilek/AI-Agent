import Groq from 'groq-sdk';
import { config } from '../config.js';
import { retrieveChunks, toChunkSources } from './retrieval.js';
import type { ChunkSource } from '@repo/types';

const groq = new Groq({ apiKey: config.GROQ_API_KEY });

const SYSTEM_PROMPT = `Sen bir şirket içi doküman asistanısın. Görevin, kullanıcıya verilen bağlam belgelerine dayanarak doğru ve kapsamlı yanıtlar vermektir.

Kurallar:
1. Sadece sağlanan bağlamdaki bilgileri kullan. Bilmiyorsan "Bu bilgi dokümanlarımda bulunmuyor" de.
2. Türkçe yanıt ver. Kullanıcı Türkçe soruyor.
3. Yanıtını maddeler halinde düzenle, okunabilir olsun.
4. Kaynak gösterirken [1], [2] şeklinde referans ver.
5. Uzun yanıtları bölümlere ayır.`;

export type RagOptions = {
  message: string;
  conversationId?: string;
  onChunk: (text: string) => void;
  onSources?: (sources: ChunkSource[]) => void;
};

export type RagResult = {
  answer: string;
  sources: ChunkSource[];
};

export async function runRag(options: RagOptions): Promise<RagResult> {
  const { message, onChunk, onSources } = options;

  const chunks = await retrieveChunks(message, 5);
  const sources = toChunkSources(chunks);

  if (onSources) onSources(sources);

  const context = sources.map((s, i) => `[${i + 1}] ${s.excerpt}`).join('\n\n');

  const stream = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Bağlam:\n${context}\n\nSoru: ${message}` },
    ],
    temperature: 0.3,
    max_tokens: 2048,
    stream: true,
  });

  let answer = '';

  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content ?? '';
    if (text) {
      answer += text;
      onChunk(text);
    }
  }

  return { answer, sources };
}
