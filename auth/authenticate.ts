#!/usr/bin/env tsx
/**
 * Microsoft Authentication Script
 *
 * Usage:
 *   npm run auth        # Authenticate to Power Apps (base session)
 *   npm run auth:mda    # Authenticate to Model-Driven App (Dynamics 365 domain)
 *
 * Both commands open a browser window. Sign in and approve MFA when prompted.
 * Sessions are saved to .playwright-ms-auth/ and last 24 hours.
 */

import { chromium } from '@playwright/test';
import { authenticate, loadConfigFromEnv, getStorageStatePath } from 'playwright-ms-auth';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const isHeadful = process.argv.includes('--headful');
const isMda     = process.argv.includes('--mda');

async function authenticatePowerApps() {
  console.log('\n🔐 Authenticating to Power Apps...\n');

  const config = loadConfigFromEnv() as any;
  config.headless = !isHeadful;

  const targetUrl = process.env.POWER_APPS_BASE_URL ?? 'https://make.powerapps.com';
  await authenticate(config, targetUrl);

  const statePath = getStorageStatePath(config.email);
  console.log(`\n✅ Saved session to: ${statePath}`);
}

async function authenticateModelDriven() {
  console.log('\n🔐 Authenticating to Model-Driven App (Dynamics 365 domain)...\n');

  const email = process.env.MS_AUTH_EMAIL;
  const mdaUrl = process.env.MODEL_DRIVEN_APP_URL;

  if (!email) throw new Error('MS_AUTH_EMAIL is required in .env');
  if (!mdaUrl) throw new Error('MODEL_DRIVEN_APP_URL is required in .env');

  // Derive paths
  const baseStatePath = getStorageStatePath(email);
  const stateDir      = path.dirname(baseStatePath);
  const mdaStatePath  = path.join(stateDir, `state-mda-${email}.json`);

  console.log(`  Email : ${email}`);
  console.log(`  URL   : ${mdaUrl}`);
  console.log(`  State : ${mdaStatePath}\n`);

  // Run base auth first if no session exists yet
  if (!fs.existsSync(baseStatePath)) {
    console.log('⚠️  No base session found — running base auth first...\n');
    await authenticatePowerApps();
  }

  // Launch Chromium with the existing base session
  const browser = await chromium.launch({ headless: !isHeadful });
  const context = await browser.newContext({
    storageState: baseStatePath,
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    await page.goto(mdaUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(5_000);

    const hasError = (await page.locator('text=An error has occurred').count()) > 0;
    if (hasError) {
      await page.screenshot({ path: 'mda-auth-error.png', fullPage: true });
      throw new Error('MDA returned an error page. Check your MODEL_DRIVEN_APP_URL and user permissions. Screenshot saved to mda-auth-error.png.');
    }

    await context.storageState({ path: mdaStatePath });
    console.log(`✅ MDA session saved to: ${mdaStatePath}`);
  } finally {
    await browser.close();
  }
}

(async () => {
  try {
    if (isMda) {
      await authenticateModelDriven();
    } else {
      await authenticatePowerApps();
    }
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌', err.message);
    console.log('\nRequired .env variables:');
    console.log('  MS_AUTH_EMAIL, MS_USER_PASSWORD (or certificate config)');
    console.log('  MODEL_DRIVEN_APP_URL (for --mda flag)');
    process.exit(1);
  }
})();
