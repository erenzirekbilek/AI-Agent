'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { streamChat, fetchConversations, fetchMessages } from '@/lib/api';
import type { ChatMessage, ChunkSource } from '@repo/types';
import type { Conversation } from '@/lib/api';

export type Message = ChatMessage;

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const cancelRef = useRef<(() => void) | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const convs = await fetchConversations();
      setConversations(convs);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    fetchMessages(activeConvId).then(setMessages).catch(() => {});
  }, [activeConvId]);

  const newConversation = useCallback(() => {
    setActiveConvId(null);
    setMessages([]);
    setStreamText('');
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || streaming) return;

    setMessages((prev) => [
      ...prev,
      {
        id: 'temp-' + Date.now(),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);

    setStreaming(true);
    setStreamText('');

    let fullAnswer = '';
    let sources: ChunkSource[] = [];

    cancelRef.current = streamChat(
      text,
      activeConvId ?? undefined,
      (token) => {
        fullAnswer += token;
        setStreamText(fullAnswer);
      },
      (id) => {
        if (id !== activeConvId) {
          setActiveConvId(id);
          loadConversations();
        }
      },
      (srcs) => {
        sources = srcs;
      },
      () => {
        setMessages((prev) => [
          ...prev,
          {
            id: 'assistant-' + Date.now(),
            role: 'assistant',
            content: fullAnswer,
            sources,
            createdAt: new Date().toISOString(),
          },
        ]);
        setStreamText('');
        setStreaming(false);
        loadConversations();
      },
      (err) => {
        setMessages((prev) => [
          ...prev,
          {
            id: 'assistant-' + Date.now(),
            role: 'assistant',
            content: `Hata: ${err}`,
            createdAt: new Date().toISOString(),
          },
        ]);
        setStreamText('');
        setStreaming(false);
      },
    );
  }, [activeConvId, streaming, loadConversations]);

  const cancel = useCallback(() => {
    cancelRef.current?.();
    setStreaming(false);
    setStreamText('');
  }, []);

  return {
    conversations,
    activeConvId,
    setActiveConvId,
    messages,
    streaming,
    streamText,
    sendMessage,
    cancel,
    newConversation,
  };
}
