import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import { processDocument } from '../services/document_processor.js';
import { supabase } from '../db/supabase.js';
import { qdrant, COLLECTION_NAME } from '../db/qdrant.js';
import * as repo from '../db/repositories.js';
import { optionalAuth } from '../middleware/auth.js';

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
router.post('/upload', optionalAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Dosya gerekli' });
  }

  try {
    const result = await processDocument(
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      req.auth?.userId ?? 'anonymous'
    );

    await fs.unlink(req.file.path).catch(() => {});
    res.status(201).json(result);
  } catch (err) {
    await fs.unlink(req.file.path).catch(() => {});
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/documents
router.get('/', optionalAuth, async (_req, res) => {
  try {
    const documents = await repo.listDocuments();
    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', optionalAuth, async (req, res) => {
  const { id } = req.params;

  try {
    await qdrant.delete(COLLECTION_NAME, {
      filter: {
        must: [{ key: 'documentId', match: { value: id } }],
      },
    });

    await repo.deleteDocument(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
