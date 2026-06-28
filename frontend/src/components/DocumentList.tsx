'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchDocuments, deleteDocument } from '@/lib/api';
import type { Document } from '@repo/types';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentList() {
  const qc = useQueryClient();
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: fetchDocuments,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  if (isLoading) {
    return <p style={{ color: '#555', textAlign: 'center' }}>Yükleniyor...</p>;
  }

  if (!docs.length) {
    return (
      <p style={{ color: '#333', textAlign: 'center', padding: '40px 0' }}>
        Henüz yüklü doküman yok
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {docs.map((doc: Document) => (
        <div
          key={doc.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            background: '#1a1a1a',
            borderRadius: 10,
            border: '1px solid #2a2a2a',
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{doc.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#555' }}>
              {formatBytes(doc.sizeBytes)} · {doc.chunkCount} parça
            </p>
          </div>
          <button
            onClick={() => {
              if (confirm('Bu dokümanı silmek istediğinize emin misiniz?')) {
                deleteMutation.mutate(doc.id);
              }
            }}
            disabled={deleteMutation.isPending}
            style={{
              background: 'transparent',
              border: '1px solid #3a2020',
              borderRadius: 6,
              color: '#ef4444',
              fontSize: 12,
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            Sil
          </button>
        </div>
      ))}
    </div>
  );
}
