#!/usr/bin/env tsx
/**
 * Seed script — generate N fake MDA records and save them to data/generated/.
 *
 * Usage:
 *   npx tsx data/seed.ts                                     # 5 records, domain from .env
 *   npx tsx data/seed.ts --count=10 --domain=generic
 *   npx tsx data/seed.ts --count=10 --domain=airline
 *   npx tsx data/seed.ts --count=5  --domain=healthcare
 *   npx tsx data/seed.ts --count=8  --domain=government
 *   npx tsx data/seed.ts --count=10 --seed=42               # reproducible (same data every run)
 *
 * The file in data/generated/ acts as a queue.
 * Each test run pops one record off the front. Re-run this script to refill.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createBatch, resolveProfile, seedFaker } from './factory';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const args    = process.argv.slice(2);
const getArg  = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];

const count  = parseInt(getArg('count')  ?? '5');
const domain = getArg('domain') ?? process.env.FAKER_DOMAIN ?? 'generic';
const seed   = getArg('seed');

if (seed !== undefined) {
  seedFaker(parseInt(seed));
  console.log(`\n🌱 Faker seed: ${seed} — data is reproducible`);
}

(async () => {
  const profile = await resolveProfile(domain);
  const records = createBatch(profile, count);

  console.log(`\n📋 Generated ${count} ${domain} record(s):\n`);
  console.table(records);

  const outputDir = path.join(__dirname, 'generated');
  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp  = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  const outputFile = path.join(outputDir, `${domain}-${timestamp}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(records, null, 2));

  console.log(`\n✅ Saved to: ${outputFile}`);
  console.log(`\nRun your tests — each run will consume one record from this queue:`);
  console.log(`  npx playwright test --project=mda`);
  console.log(`\nRefill the queue anytime by re-running this script.`);
})();
