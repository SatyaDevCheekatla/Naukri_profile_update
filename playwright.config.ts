import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file in the project root
dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Playwright Configuration for Naukri Resume Automation
 * ─────────────────────────────────────────────────────
 * - Uses Chromium only (required for stealth plugin compatibility)
 * - Extended timeouts to handle Naukri's slow-loading pages & anti-bot delays
 * - Retries disabled by default for deterministic debugging
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  use: {
    /* Extended timeout — Naukri pages can be slow */
    actionTimeout: 30_000,
    navigationTimeout: 60_000,

    /* Collect trace & screenshot on failure for debugging */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'naukri-chromium',
      use: {
        ...devices['Desktop Chrome'],
        /* Override viewport for consistency */
        viewport: { width: 1366, height: 768 },
        /* Headed mode by default for debugging; set to true for CI */
        headless: false,
      },
    },
  ],
});
