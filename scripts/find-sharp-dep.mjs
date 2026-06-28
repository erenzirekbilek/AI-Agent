import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const dir = 'D:\\software-projects\\production-ai-app\\node_modules\\@xenova\\transformers\\src';

function findRequires(dir, depth = 0) {
  if (depth > 2) return;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) findRequires(p, depth + 1);
      else if (e.name.endsWith('.js') || e.name.endsWith('.mjs') || e.name.endsWith('.cjs')) {
        const content = readFileSync(p, 'utf8');
        if (content.toLowerCase().includes('sharp')) {
          console.log(p);
        }
      }
    }
  } catch(e) {}
}
findRequires(dir);
