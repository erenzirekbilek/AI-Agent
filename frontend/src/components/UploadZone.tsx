'use client';

import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { uploadDocument } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

export function UploadZone() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  async function upload(file: File) {
    setUploading(true);
    setError('');
    try {
      await uploadDocument(file);
      qc.invalidateQueries({ queryKey: ['documents'] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = '';
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      style={{
        border: `2px dashed ${dragging ? '#6366f1' : '#2a2a2a'}`,
        borderRadius: 12,
        padding: '48px 24px',
        textAlign: 'center',
        marginBottom: 32,
        cursor: uploading ? 'wait' : 'pointer',
        transition: 'border-color 0.2s',
        background: dragging ? '#1a1a2e' : 'transparent',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        style={{ display: 'none' }}
        onChange={onChange}
      />
      <div style={{ fontSize: 32, marginBottom: 12 }}>{uploading ? '⏳' : '📄'}</div>
      <p style={{ color: '#aaa', fontSize: 14, margin: 0 }}>
        {uploading ? 'Yükleniyor...' : 'Dosyaları buraya sürükleyin veya tıklayın'}
      </p>
      <p style={{ color: '#555', fontSize: 12, margin: '6px 0 0' }}>PDF, DOCX, TXT · Maks 50MB</p>
      {error && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
