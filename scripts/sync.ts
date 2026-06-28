import chokidar from 'chokidar';
import path from 'node:path';
import fs from 'node:fs/promises';
import 'dotenv/config';
import { processDocument } from '../app/services/document_processor.js';
import { ensureCollection } from '../app/db/qdrant.js';

const WATCH_DIR = path.resolve('data/raw');
const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
};

await ensureCollection();
console.log(`👀 İzleniyor: ${WATCH_DIR}`);

chokidar.watch(WATCH_DIR, { ignoreInitial: false })
  .on('error', (err) => console.error('❌ Watcher hatası:', err))
  .on('add', async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_MAP[ext];
  if (!mimeType) return;

  console.log(`📄 Yeni dosya: ${filePath}`);

  try {
    const stat = await fs.stat(filePath);
    const result = await processDocument(
      filePath,
      path.basename(filePath),
      mimeType,
      stat.size,
      'sync-bot'
    );
    console.log(`✅ ${result.document.name} — ${result.chunksCreated} chunk oluşturuldu`);
  } catch (err) {
    console.error(`❌ İşlenemedi: ${filePath}`, (err as Error).message);
  }
  });
