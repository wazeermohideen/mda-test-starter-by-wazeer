import * as path from 'path';
import { findQaUser } from '../data/qa-config';

const STATE_DIR = '.playwright-ms-auth';

function sanitizeFileSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function buildStorageStatePath(tag: string, identifier: string): string {
  return path.join(STATE_DIR, `state-${tag}-${sanitizeFileSegment(identifier)}.json`);
}

export function resolveStorageStatePath(tag: string, userAliasOrEmail?: string): string | undefined {
  if (!userAliasOrEmail && !process.env.MS_AUTH_EMAIL) {
    return undefined;
  }

  const configuredUser = userAliasOrEmail ? findQaUser(userAliasOrEmail) : undefined;
  const stateIdentifier = configuredUser?.email
    ?? configuredUser?.alias
    ?? userAliasOrEmail
    ?? process.env.MS_AUTH_EMAIL;

  return stateIdentifier ? buildStorageStatePath(tag, stateIdentifier) : undefined;
}
