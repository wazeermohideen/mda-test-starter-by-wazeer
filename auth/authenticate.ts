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

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const isMda = process.argv.includes('--mda');

const STATE_DIR = path.resolve('.playwright-ms-auth');

function stateFilePath(tag: string): string {
  const email = process.env.MS_AUTH_EMAIL ?? 'user';
  return path.join(STATE_DIR, `state-${tag}-${email}.json`);
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
    url => !url.includes('login.microsoftonline.com') && !url.includes('login.microsoft.com'),
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
  const email = process.env.MS_AUTH_EMAIL;
  const mdaUrl = process.env.MODEL_DRIVEN_APP_URL;

  if (!email) {
    console.error('❌ MS_AUTH_EMAIL is required in .env');
    process.exit(1);
  }

  try {
    if (isMda) {
      if (!mdaUrl) {
        console.error('❌ MODEL_DRIVEN_APP_URL is required in .env for --mda auth');
        process.exit(1);
      }
      const statePath = stateFilePath('mda');
      await signInInteractive(mdaUrl, statePath, 'Model-Driven App (Dynamics 365)');
    } else {
      const baseUrl = process.env.POWER_APPS_BASE_URL ?? 'https://make.powerapps.com';
      const statePath = stateFilePath('powerapps');
      await signInInteractive(baseUrl, statePath, 'Power Apps');
    }
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌', err.message);
    process.exit(1);
  }
})();
