import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import { processDocument } from '../services/document_processor.js';
import { supabase } from '../db/supabase.js';
import { qdrant, COLLECTION_NAME } from '../db/qdrant.js';

const router = Router();

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const upload = multer({
  dest: 'data/uploads/',
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece PDF, DOCX ve TXT dosyaları desteklenir'));
    }
  },
});

// POST /api/documents/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Dosya gerekli' });
  }

  try {
    const result = await processDocument(
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      (req as any).auth?.userId ?? 'anonymous'
    );

    await fs.unlink(req.file.path).catch(() => {});
    res.status(201).json(result);
  } catch (err) {
    await fs.unlink(req.file.path).catch(() => {});
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/documents
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/documents/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await qdrant.delete(COLLECTION_NAME, {
      filter: {
        must: [{ key: 'documentId', match: { value: id } }],
      },
    });

    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
