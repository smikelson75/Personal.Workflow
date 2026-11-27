import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function recordPath(homePath) {
  return resolve(join(homePath, 'skill-review', 'review-record.json'));
}

export function readRecord(homePath) {
  const file = recordPath(homePath);
  if (!existsSync(file)) {
    return { format: 1, conversations: {}, handoffs: [], observations: [], installs: [], nextObservation: 1 };
  }
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    data = null;
  }
  if (data === null || typeof data !== 'object' || data.format !== 1) {
    const err = new Error(`records-unreadable: ${file}`);
    err.category = 'records-unreadable';
    err.detail = file;
    throw err;
  }
  return data;
}
