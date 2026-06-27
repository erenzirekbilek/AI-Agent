import 'dotenv/config';

const checks = [
  { name: 'Backend', url: `http://localhost:${process.env.PORT ?? 3001}/health` },
  { name: 'Qdrant', url: `${process.env.QDRANT_URL ?? 'http://localhost:6333'}/healthz` },
];

async function check(name: string, url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const ok = res.ok;
    console.log(`${ok ? '✅' : '❌'} ${name}: ${res.status}`);
    return ok;
  } catch {
    console.log(`❌ ${name}: unreachable`);
    return false;
  }
}

const results = await Promise.all(checks.map(c => check(c.name, c.url)));
process.exit(results.every(Boolean) ? 0 : 1);
