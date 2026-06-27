export interface Document {
  id: string;
  name: string;
  mimeType: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' | 'text/plain';
  sizeBytes: number;
  chunkCount: number;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  embedding?: number[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChunkSource[];
  createdAt: string;
}

export interface ChunkSource {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  score: number;
  excerpt: string;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface UploadResponse {
  document: Document;
  chunksCreated: number;
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  services: {
    qdrant: boolean;
    supabase: boolean;
    groq: boolean;
  };
}
