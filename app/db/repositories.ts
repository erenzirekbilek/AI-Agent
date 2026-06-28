import { supabase } from './supabase.js';
import type { Document, Chunk, ChatMessage, ChunkSource } from '@repo/types';

// ── Documents ──────────────────────────────────────────
export async function listDocuments(): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Dokümanlar listelenemedi: ${error.message}`);
  return (data ?? []).map(mapDocument);
}

export async function getDocument(id: string): Promise<Document | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return mapDocument(data);
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) throw new Error(`Doküman silinemedi: ${error.message}`);
}

// ── Conversations ──────────────────────────────────────
export async function listConversations(userId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Konuşmalar listelenemedi: ${error.message}`);
  return data ?? [];
}

export async function createConversation(userId: string, title = 'Yeni Sohbet') {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title })
    .select()
    .single();

  if (error) throw new Error(`Konuşma oluşturulamadı: ${error.message}`);
  return data;
}

export async function updateConversationTitle(id: string, title: string) {
  const { error } = await supabase
    .from('conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Konuşma güncellenemedi: ${error.message}`);
}

// ── Messages ──────────────────────────────────────────
export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Mesajlar listelenemedi: ${error.message}`);
  return (data ?? []).map(mapMessage);
}

export async function insertMessage(msg: {
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChunkSource[];
}) {
  const { error } = await supabase.from('messages').insert({
    conversation_id: msg.conversation_id,
    role: msg.role,
    content: msg.content,
    sources: msg.sources ? JSON.stringify(msg.sources) : '[]',
  });

  if (error) throw new Error(`Mesaj kaydedilemedi: ${error.message}`);
}

// ── Feedback ──────────────────────────────────────────
export async function insertFeedback(messageId: string, rating: number, comment?: string) {
  const { error } = await supabase.from('feedback').insert({
    message_id: messageId,
    rating,
    comment,
  });

  if (error) throw new Error(`Geri bildirim kaydedilemedi: ${error.message}`);
}

// ── Mappers ────────────────────────────────────────────
function mapDocument(row: any): Document {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    chunkCount: row.chunk_count,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: any): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    sources: typeof row.sources === 'string' ? JSON.parse(row.sources) : row.sources ?? [],
    createdAt: row.created_at,
  };
}
