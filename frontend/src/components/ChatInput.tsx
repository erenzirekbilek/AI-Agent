'use client';

import { useState, KeyboardEvent } from 'react';

type Props = {
  onSend: (text: string) => void;
  streaming: boolean;
  onCancel: () => void;
};

export function ChatInput({ onSend, streaming, onCancel }: Props) {
  const [text, setText] = useState('');

  function submit() {
    if (!text.trim() || streaming) return;
    onSend(text.trim());
    setText('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div style={{ padding: '16px 24px', borderTop: '1px solid #1e1e1e' }}>
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          background: '#1a1a1a',
          borderRadius: 12,
          padding: '12px 16px',
          border: '1px solid #2a2a2a',
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Bir şeyler sorun... (Enter ile gönder)"
          rows={1}
          disabled={streaming}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: 14,
            resize: 'none',
            fontFamily: 'inherit',
            opacity: streaming ? 0.5 : 1,
          }}
        />
        {streaming ? (
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #444',
              background: 'transparent',
              color: '#aaa',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Durdur
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!text.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: text.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#2a2a2a',
              border: 'none',
              color: text.trim() ? '#fff' : '#555',
              fontSize: 13,
              fontWeight: 500,
              cursor: text.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }}
          >
            Gönder
          </button>
        )}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 11, color: '#333', textAlign: 'center' }}>
        Enter ile gönder · Shift+Enter yeni satır
      </p>
    </div>
  );
}
