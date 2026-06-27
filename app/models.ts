export type DocumentRow = {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  chunk_count: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
};

export type ChunkRow = {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  created_at: string;
};

export type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: string; // JSON string
  created_at: string;
};
