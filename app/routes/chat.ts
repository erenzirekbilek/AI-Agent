import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { runRag } from '../services/rag.js';
import * as repo from '../db/repositories.js';
import type { ChunkSource } from '@repo/types';

const router = Router();

const chatSchema = z.object({
  message: z.string().min(1, 'Mesaj boş olamaz'),
  conversationId: z.string().optional(),
});

// POST /api/chat — send a message, stream the answer
router.post('/', requireAuth, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  }

  const { message, conversationId: inputConvId } = parsed.data;
  const userId = req.auth!.userId;

  try {
    // Get or create conversation
    const convId = inputConvId ?? (await repo.createConversation(userId, message.slice(0, 80))).id;

    // Save user message
    await repo.insertMessage({
      conversation_id: convId,
      role: 'user',
      content: message,
    });

    // SSE setup
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send conversation ID first
    res.write(`data: ${JSON.stringify({ type: 'meta', conversationId: convId })}\n\n`);

    let sources: ChunkSource[] = [];

    const result = await runRag({
      message,
      conversationId: convId,
      onChunk: (text) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
      },
      onSources: (srcs) => {
        sources = srcs;
      },
    });

    // Save assistant message
    await repo.insertMessage({
      conversation_id: convId,
      role: 'assistant',
      content: result.answer,
      sources,
    });

    // Auto-title first message
    if (!inputConvId && message.length > 80) {
      await repo.updateConversationTitle(convId, message.slice(0, 80) + '...');
    }

    // Send done + sources
    res.write(`data: ${JSON.stringify({ type: 'done', sources })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Chat error:', err);
    const msg = (err as Error).message;
    if (res.headersSent) {
      try { res.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`); res.end(); } catch {}
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// GET /api/chat/conversations — list user conversations
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const conversations = await repo.listConversations(req.auth!.userId);
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/chat/conversations/:id — get messages
router.get('/conversations/:id', requireAuth, async (req, res) => {
  try {
    const messages = await repo.listMessages(req.params.id);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /api/chat/conversations/:id
router.delete('/conversations/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await (await import('../db/supabase.js')).supabase
      .from('conversations')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.auth!.userId);

    if (error) return res.status(500).json({ error: error.message });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
