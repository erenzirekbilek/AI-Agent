'use client';

import type { ChatMessage } from '@repo/types';

type Props = {
  messages: ChatMessage[];
  streaming: boolean;
  streamText: string;
};

export function MessageList({ messages, streaming, streamText }: Props) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}
        >
          <div
            style={{
              maxWidth: '75%',
              padding: '12px 16px',
              borderRadius: 12,
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                : '#1a1a1a',
              border: msg.role === 'assistant' ? '1px solid #2a2a2a' : 'none',
              fontSize: 14,
              lineHeight: 1.6,
              color: '#fff',
              whiteSpace: 'pre-wrap',
            }}
          >
            {msg.content}
            {msg.sources && msg.sources.length > 0 && (
              <div style={{ marginTop: 12, borderTop: '1px solid #333', paddingTop: 10 }}>
                <p style={{ fontSize: 11, color: '#666', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Kaynaklar
                </p>
                {msg.sources.map((s, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
                      📄 {s.documentName} · <span style={{ color: '#555' }}>{Math.round(s.score * 100)}% eşleşme</span>
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#555', fontStyle: 'italic' }}>
                      &quot;{s.excerpt.slice(0, 100)}...&quot;
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {streaming && streamText && (
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div
            style={{
              maxWidth: '75%',
              padding: '12px 16px',
              borderRadius: 12,
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              fontSize: 14,
              lineHeight: 1.6,
              color: '#fff',
              whiteSpace: 'pre-wrap',
            }}
          >
            {streamText}
            <span style={{ marginLeft: 2 }}>▋</span>
          </div>
        </div>
      )}

      {streaming && !streamText && (
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ padding: '12px 16px', borderRadius: 12, background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
            <span style={{ color: '#888' }}>Yanıt oluşturuluyor...</span>
          </div>
        </div>
      )}
    </div>
  );
}
