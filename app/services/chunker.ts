export function chunkText(text: string, maxTokens: number, overlap: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (overlap >= maxTokens) {
    throw new Error(`overlap (${overlap}) must be less than maxTokens (${maxTokens})`);
  }

  const words = trimmed.split(/\s+/);
  if (words.length <= maxTokens) return [trimmed];

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + maxTokens, words.length);
    chunks.push(words.slice(start, end).join(' '));
    if (end === words.length) break;
    start += maxTokens - overlap;
  }

  return chunks;
}
