import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { ensureCollection } from './db/qdrant.js';
import { supabase } from './db/supabase.js';
import Groq from 'groq-sdk';
import documentsRouter from './routes/documents.js';
import chatRouter from './routes/chat.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
app.use(express.json({ limit: '50mb' }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Health check — checks all downstream services
app.get('/health', async (_req, res) => {
  const checks = {
    qdrant: false,
    supabase: false,
    groq: false,
  };

  try {
    await ensureCollection();
    checks.qdrant = true;
  } catch {}

  try {
    const { error } = await supabase.from('documents').select('id').limit(1);
    checks.supabase = !error;
  } catch {}

  try {
    const groq = new Groq({ apiKey: config.GROQ_API_KEY });
    await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    });
    checks.groq = true;
  } catch {}

  const allOk = Object.values(checks).every(Boolean);
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: checks,
  });
});

app.use('/api/documents', documentsRouter);
app.use('/api/chat', chatRouter);

ensureCollection().catch(console.error);

app.listen(config.PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${config.PORT}`);
});

export default app;
