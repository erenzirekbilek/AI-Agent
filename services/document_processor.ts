import fs from 'node:fs/promises';
import path from 'node:path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { v4 as uuidv4 } from 'uuid';
import { chunkText } from './chunker.js';
import { embedBatch } from './embedding.js';
import { supabase } from '../app/db/supabase.js';
import { qdrant, COLLECTION_NAME } from '../app/db/qdrant.js';
import type { Document } from '@repo/types';

export type ProcessResult = {
  document: Document;
  chunksCreated: number;
};

async function extractText(filePath: string, mimeType: string): Promise<string> {
  const buffer = await fs.readFile(filePath);

  if (mimeType === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return buffer.toString('utf-8');
}

export async function processDocument(
  filePath: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
  uploadedBy: string
): Promise<ProcessResult> {
  const text = await extractText(filePath, mimeType);
  const chunks = chunkText(text, 512, 50);

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      name: fileName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      chunk_count: chunks.length,
      uploaded_by: uploadedBy,
    })
    .select()
    .single();

  if (docError || !doc) throw new Error(`Doküman kaydedilemedi: ${docError?.message}`);

  const embeddings = await embedBatch(chunks);

  const points = chunks.map((content, i) => ({
    id: uuidv4(),
    vector: embeddings[i],
    payload: {
      documentId: doc.id,
      documentName: fileName,
      chunkIndex: i,
      content,
    },
  }));

  await qdrant.upsert(COLLECTION_NAME, { points });

  const chunkRows = chunks.map((content, i) => ({
    document_id: doc.id,
    content,
    chunk_index: i,
  }));

  await supabase.from('chunks').insert(chunkRows);

  return {
    document: {
      id: doc.id,
      name: doc.name,
      mimeType: doc.mime_type as Document['mimeType'],
      sizeBytes: doc.size_bytes,
      chunkCount: chunks.length,
      uploadedBy: doc.uploaded_by,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    },
    chunksCreated: chunks.length,
  };
}
