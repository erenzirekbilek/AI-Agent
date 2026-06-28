'use client';

import { useEffect } from 'react';
import { UserButton, useAuth } from '@clerk/nextjs';
import { setTokenGetter } from '@/lib/api';
import { useChat } from '@/hooks/useChat';
import { MessageList } from '@/components/MessageList';
import { ChatInput } from '@/components/ChatInput';

const EXAMPLE_QUESTIONS = [
  'İzin politikası nedir?',
  'Onboarding süreci nasıl işler?',
  'Teknik mimari belgesi var mı?',
];

export default function ChatPage() {
  const { getToken } = useAuth();
  const {
    conversations,
    activeConvId,
    setActiveConvId,
    messages,
    streaming,
    streamText,
    sendMessage,
    cancel,
    newConversation,
  } = useChat();

  useEffect(() => {
    setTokenGetter(() => getToken().catch(() => null));
  }, [getToken]);

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#fff', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: '1px solid #1e1e1e', flexShrink: 0,
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
          <a href="/documents" style={{ color: '#888', fontSize: 14, textDecoration: 'none' }}>Dokümanlar</a>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <aside style={{
          width: 240, borderRight: '1px solid #1e1e1e', padding: '16px 12px',
          display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
        }}>
          <button
            onClick={newConversation}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none', color: '#fff', fontSize: 14, fontWeight: 500,
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            + Yeni Sohbet
          </button>
          <div style={{ marginTop: 8, overflowY: 'auto', flex: 1 }}>
            <p style={{ fontSize: 11, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Geçmiş
            </p>
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                style={{
                  padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                  fontSize: 13, color: conv.id === activeConvId ? '#fff' : '#888',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  background: conv.id === activeConvId ? '#1e1e1e' : 'transparent',
                }}
              >
                {conv.title}
              </div>
            ))}
          </div>
        </aside>

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {messages.length === 0 && !streaming ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
              }}>✦</div>
              <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Nasıl yardımcı olabilirim?</h1>
              <p style={{ color: '#555', fontSize: 14, margin: 0 }}>Şirket dokümanlarınız hakkında soru sorun</p>
              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    style={{
                      padding: '8px 16px', borderRadius: 20,
                      background: '#1a1a1a', border: '1px solid #2a2a2a',
                      color: '#aaa', fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <MessageList messages={messages} streaming={streaming} streamText={streamText} />
          )}
          <ChatInput onSend={sendMessage} streaming={streaming} onCancel={cancel} />
        </main>
      </div>
    </div>
  );
}
