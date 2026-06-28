import type { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header eksik' });
  }

  const token = header.slice(7);

  try {
    const claims = await clerkClient.verifyToken(token);
    req.auth = { userId: claims.sub };
    next();
  } catch {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' });
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    req.auth = { userId: 'anonymous' };
    return next();
  }

  const token = header.slice(7);

  clerkClient.verifyToken(token)
    .then((claims) => {
      req.auth = { userId: claims.sub };
      next();
    })
    .catch(() => {
      req.auth = { userId: 'anonymous' };
      next();
    });
}
