import * as fs from 'fs';
import * as path from 'path';
import { MdaRecord } from './factory';

const GENERATED_DIR = path.join(__dirname, 'generated');

/**
 * Loads the next record from the newest seed file for the given domain.
 * Acts as a queue — pops one record per call and writes the rest back to disk.
 * Returns null if no seed file exists (tests will generate live data instead).
 */
export function loadSeeded(domain: string): MdaRecord | null {
  if (!fs.existsSync(GENERATED_DIR)) return null;

  const files = fs.readdirSync(GENERATED_DIR)
    .filter(f => f.startsWith(`${domain}-`) && f.endsWith('.json'))
    .sort()
    .reverse(); // newest first

  if (files.length === 0) return null;

  const filePath = path.join(GENERATED_DIR, files[0]);
  const records: MdaRecord[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  if (records.length === 0) return null;

  const record = records.shift()!;
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2));

  console.log(`[loader] Loaded pre-seeded ${domain} record. ${records.length} remaining in queue.`);
  return record;
}
