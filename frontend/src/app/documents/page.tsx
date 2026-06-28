'use client';

import { useEffect } from 'react';
import { UserButton, useAuth } from '@clerk/nextjs';
import { setTokenGetter } from '@/lib/api';
import { UploadZone } from '@/components/UploadZone';
import { DocumentList } from '@/components/DocumentList';

export default function DocumentsPage() {
  const { getToken } = useAuth();

  useEffect(() => {
    setTokenGetter(() => getToken().catch(() => null));
  }, [getToken]);

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: '1px solid #1e1e1e',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>✦</div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Şirket Asistanı</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/chat" style={{ color: '#888', fontSize: 14, textDecoration: 'none' }}>Sohbet</a>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </header>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 6px' }}>Dokümanlar</h1>
          <p style={{ color: '#555', fontSize: 14, margin: 0 }}>PDF, DOCX ve TXT dosyalarını yükleyin</p>
        </div>
        <UploadZone />
        <DocumentList />
      </div>
    </div>
  );
}
