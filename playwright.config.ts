import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.test.ts',
  fullyParallel: false,
  retries: 0,
  workers: parseInt(process.env.WORKERS ?? '1'),
  timeout: 180_000,

  reporter: process.env.CI
    ? [
        ['dot'],
        ['html', { open: 'never' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
        ['allure-playwright', { outputFolder: 'allure-results' }],
      ]
    : [
        ['list'],
        ['html', { open: 'never' }],
        ['allure-playwright', { outputFolder: 'allure-results' }],
      ],

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
      // storageState is not set here — the `storageState` fixture in
      // fixtures/mda.fixtures.ts resolves it per-test from `userAlias`,
      // so each test/describe block can run as a different QA user.
      name: 'mda',
    },
  ],

  outputDir: 'test-results/artifacts',
});
