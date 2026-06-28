import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  GROQ_API_KEY: z.string().min(1),
  HUGGINGFACE_API_KEY: z.string().min(1),
  QDRANT_URL: z.string().url(),
  QDRANT_API_KEY: z.string().optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
