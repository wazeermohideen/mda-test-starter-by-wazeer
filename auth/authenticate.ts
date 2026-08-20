#!/usr/bin/env tsx
/**
 * Microsoft Authentication Script
 *
 * Usage:
 *   npm run auth:headful      # Authenticate to Power Apps
 *   npm run auth:mda:headful  # Authenticate to Model-Driven App (Dynamics CRM domain)
 *
 * A browser window opens. Sign in with your Microsoft account using whatever
 * method your org uses (SSO, MFA app, Windows Hello, etc.).
 * Sessions are saved to .playwright-ms-auth/ and last 24 hours.
 */

import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { buildStorageStatePath } from '../helpers/test-users';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const isMda = process.argv.includes('--mda');
const userArgIndex = process.argv.findIndex(arg => arg === '--user');
const userAlias = userArgIndex >= 0 ? process.argv[userArgIndex + 1] : undefined;

const STATE_DIR = path.resolve('.playwright-ms-auth');

async function resolveSelectedUser() {
  if (!userAlias) {
    return undefined;
  }

  const { findQaUser } = await import('../data/qa-config');
  const matchedUser = findQaUser(userAlias);
  if (!matchedUser) {
    throw new Error(`Unknown QA user "${userAlias}". Check qa.config.json.`);
  }

  return matchedUser;
}

function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
}

async function signInInteractive(targetUrl: string, statePath: string, label: string) {
  console.log(`\n🔐 Authenticating — ${label}\n`);
  console.log(`  Opening: ${targetUrl}`);
  console.log('  Sign in with your Microsoft account in the browser window.');
  console.log('  The script saves your session automatically once you are logged in.\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  // Wait until sign-in completes — URL leaves the Microsoft login domain
  console.log('  Waiting for sign-in to complete (up to 3 minutes)...\n');
  await page.waitForURL(
    url => !url.href.includes('login.microsoftonline.com') && !url.href.includes('login.microsoft.com'),
    { timeout: 180_000 }
  );

  // Give the page a moment to settle and set cookies
  await page.waitForTimeout(3_000);

  ensureStateDir();
  await context.storageState({ path: statePath });
  await browser.close();

  console.log(`✅ Session saved to: ${statePath}`);
  console.log('   Re-run this command every 24 hours or when you see auth errors.\n');
}

(async () => {
  const selectedUser = await resolveSelectedUser();
  const email = selectedUser?.email ?? process.env.MS_AUTH_EMAIL;
  const mdaUrl = process.env.MODEL_DRIVEN_APP_URL;

  if (!email) {
    console.error('❌ MS_AUTH_EMAIL is required in .env, or provide --user with an email-backed entry from qa.config.json');
    process.exit(1);
  }

  try {
    if (isMda) {
      if (!mdaUrl) {
        console.error('❌ MODEL_DRIVEN_APP_URL is required in .env for --mda auth');
        process.exit(1);
      }
      const statePath = buildStorageStatePath('mda', email);
      const label = selectedUser
        ? `Model-Driven App (Dynamics 365) [${selectedUser.alias}]`
        : 'Model-Driven App (Dynamics 365)';
      await signInInteractive(mdaUrl, statePath, label);
    } else {
      const baseUrl = process.env.POWER_APPS_BASE_URL ?? 'https://make.powerapps.com';
      const statePath = buildStorageStatePath('powerapps', email);
      const label = selectedUser ? `Power Apps [${selectedUser.alias}]` : 'Power Apps';
      await signInInteractive(baseUrl, statePath, label);
    }
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌', err.message);
    process.exit(1);
  }
})();
