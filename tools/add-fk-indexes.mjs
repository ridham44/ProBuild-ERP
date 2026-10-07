// One-off helper: appends @@index([fk]) for every relation scalar that is not already
// the leading column of an @@index/@@unique/@id. Standards: "Index every foreign key".
// Usage: node tools/add-fk-indexes.mjs apps/api/prisma/schema
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
for (const file of readdirSync(dir).filter((f) => f.endsWith('.prisma'))) {
  const path = join(dir, file);
  const text = readFileSync(path, 'utf8');
  const out = text.replace(/^model (\w+) \{([\s\S]*?)^\}/gm, (whole, name, body) => {
    const fks = new Set();
    for (const m of body.matchAll(/@relation\([^)]*fields:\s*\[([^\]]+)\]/g)) {
      m[1].split(',').map((s) => s.trim()).forEach((f) => fks.add(f));
    }
    const covered = new Set();
    for (const m of body.matchAll(/@@(?:index|unique)\(\[([^\]]+)\]/g)) {
      covered.add(m[1].split(',')[0].trim());
    }
    const missing = [...fks].filter((f) => !covered.has(f));
    if (missing.length === 0) return whole;
    const lines = missing.map((f) => `  @@index([${f}])`).join('\n');
    const trimmed = body.replace(/\s+$/, '');
    return `model ${name} {${trimmed}\n\n${lines}\n}`;
  });
  writeFileSync(path, out);
}
