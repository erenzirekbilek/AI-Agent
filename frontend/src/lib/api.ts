import type { ChatMessage, ChunkSource, Document } from '@repo/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

async function authHeaders(contentType = true): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (contentType) headers['Content-Type'] = 'application/json';
  if (_getToken) {
    const token = await _getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = await authHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...auth, ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function fetchDocuments(): Promise<Document[]> {
  return apiFetch<Document[]>('/api/documents');
}

export async function deleteDocument(id: string): Promise<void> {
  await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
}

export async function uploadDocument(file: File): Promise<{ document: Document; chunksCreated: number }> {
  const auth = await authHeaders(false);
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_URL}/api/documents/upload`, {
    method: 'POST',
    headers: { Authorization: auth['Authorization'] ?? '' },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Yükleme başarısız' }));
    throw new Error(err.error ?? 'Yükleme başarısız');
  }
  return res.json();
}

export type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export async function fetchConversations(): Promise<Conversation[]> {
  return apiFetch<Conversation[]>('/api/chat/conversations');
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>(`/api/chat/conversations/${conversationId}`);
}

export function streamChat(
  message: string,
  conversationId: string | undefined,
  onToken: (token: string) => void,
  onConversationId: (id: string) => void,
  onSources: (sources: ChunkSource[]) => void,
  onDone: () => void,
  onError: (err: string) => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const auth = await authHeaders();
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ message, conversationId }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => '');
        let msg = 'Sunucu hatası';
        try { const j = JSON.parse(body); if (j.error) msg = j.error; } catch {}
        onError(msg);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') {
            onDone();
            return;
          }
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) {
              onError(parsed.error);
              return;
            }
            if (parsed.type === 'meta' && parsed.conversationId) {
              onConversationId(parsed.conversationId);
            }
            if (parsed.type === 'chunk' && parsed.text) {
              onToken(parsed.text);
            }
            if (parsed.type === 'done') {
              onSources(parsed.sources ?? []);
              onDone();
              return;
            }
            if (parsed.type === 'error') {
              onError(parsed.error);
              return;
            }
          } catch {
            onToken(raw);
          }
        }
      }
      onDone();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onError((err as Error).message);
      }
    }
  })();

  return () => controller.abort();
}
