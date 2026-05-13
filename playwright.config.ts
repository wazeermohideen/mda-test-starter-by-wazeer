import * as path from 'path';
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const MDA_STATE = process.env.MS_AUTH_EMAIL
  ? path.join('.playwright-ms-auth', `state-mda-${process.env.MS_AUTH_EMAIL}.json`)
  : undefined;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.test.ts',
  fullyParallel: false,
  retries: 0,
  workers: parseInt(process.env.WORKERS ?? '1'),
  timeout: 180_000,

  reporter: process.env.CI
    ? [['dot'], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    browserName: 'chromium',
    headless: process.env.HEADLESS !== 'false',
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
    video: 'on',
    trace: 'retain-on-failure',
    actionTimeout: 60_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
    locale: 'en-US',
  },

  projects: [
    {
      name: 'mda',
      use: {
        storageState: MDA_STATE,
      },
    },
  ],

  outputDir: 'test-results/artifacts',
});
