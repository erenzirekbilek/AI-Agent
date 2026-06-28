import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { ensureCollection } from './db/qdrant.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

ensureCollection().catch(console.error);

app.listen(config.PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${config.PORT}`);
});

export default app;
