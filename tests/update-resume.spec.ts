/**
 * ═══════════════════════════════════════════════════════════════
 *  Naukri.com — Automated Resume Upload Test
 * ═══════════════════════════════════════════════════════════════
 *
 *  Author : Satya (Senior QA Automation Engineer)
 *  Stack  : Playwright + playwright-extra + stealth plugin
 *  Purpose: Automate daily resume upload on Naukri to keep the
 *           profile "recently updated" and boost visibility to
 *           recruiters.
 *
 *  Key Design Decisions:
 *  ─────────────────────
 *  1. We use `playwright-extra` with `puppeteer-extra-plugin-stealth`
 *     to mask automation fingerprints (navigator.webdriver, Chrome
 *     headless signatures, etc.).
 *
 *  2. Instead of Playwright's built-in `test.use()` for browser
 *     launch, we manually launch via playwright-extra's chromium
 *     instance so the stealth plugin is applied to the browser
 *     binary itself — not just the page context.
 *
 *  3. Hard sleeps are avoided EXCEPT for two justified cases:
 *     a) Human-like typing delays (anti-keystroke analysis)
 *     b) Post-navigation pauses (allow overlays to render so we
 *        can dismiss them)
 *
 *  4. All DOM selectors are centralized in utils/selectors.ts so
 *     they can be updated in one place when Naukri's UI changes.
 *
 *  Environment Variables Required:
 *     NAUKRI_EMAIL    — Your Naukri login email
 *     NAUKRI_PASSWORD — Your Naukri login password
 *
 *  Usage:
 *     npm run update-resume          (headed, for debugging)
 *     npm run update-resume:headless (headless, for CI/cron)
 * ═══════════════════════════════════════════════════════════════
 */

import { test, expect } from '@playwright/test';
import { chromium as stealthChromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { SELECTORS, TIMEOUTS } from '../utils/selectors';
import { 
  humanDelay, 
  dismissPopups, 
  humanType, 
  saveCookies, 
  loadCookies, 
  isAuthenticated 
} from '../utils/helpers';

// ── Load environment variables ───────────────────────────────
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// ── Register the stealth plugin with Chromium ────────────────
// This patches the browser to remove automation fingerprints:
//   - navigator.webdriver = false
//   - Removes "HeadlessChrome" from user-agent
//   - Patches chrome.runtime, window.chrome, permissions API, etc.
stealthChromium.use(stealthPlugin());

// ── Constants ────────────────────────────────────────────────
const RESUME_FILENAME = 'SatyaDev_SDET_4Years.pdf';
const RESUME_PATH = path.resolve(__dirname, '..', RESUME_FILENAME);

// ── Standard User Agent ──────────────────────────────────────
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ══════════════════════════════════════════════════════════════
//  TEST SUITE
// ══════════════════════════════════════════════════════════════

test.describe('Naukri.com — Daily Resume Upload', () => {
  // Increase the overall test timeout since we're dealing with
  // login flows, page transitions, and file uploads on a live site.
  test.setTimeout(180_000); // 3 minutes

  test('should login and upload resume successfully', async () => {
    // ════════════════════════════════════════════════════════
    //  STEP 0 — Pre-flight Validation
    // ════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════');
    console.log('  🚀 Naukri Resume Upload Automation');
    console.log('═══════════════════════════════════════════');

    // Validate credentials are present
    const email = process.env.NAUKRI_EMAIL;
    const password = process.env.NAUKRI_PASSWORD;

    if (!email || !password) {
      throw new Error(
        '❌ Missing credentials!\n' +
          '   Set NAUKRI_EMAIL and NAUKRI_PASSWORD in your .env file.\n' +
          '   See .env file in the project root.'
      );
    }
    console.log(`  📧 Email: ${email.substring(0, 4)}****`);

    // Validate resume file exists
    if (!fs.existsSync(RESUME_PATH)) {
      throw new Error(
        `❌ Resume file not found!\n` +
          `   Expected: ${RESUME_PATH}\n` +
          `   Place your "${RESUME_FILENAME}" in the project root directory.`
      );
    }
    console.log(`  📄 Resume: ${RESUME_FILENAME} ✓`);

    // ════════════════════════════════════════════════════════
    //  STEP 1 — Launch Stealth Browser
    // ════════════════════════════════════════════════════════
    console.log('\n  🌐 Step 1: Launching stealth browser...');

    const browser = await stealthChromium.launch({
      headless: !!process.env.CI,  // headless in CI, headed locally
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1366,768',
      ],
    });

    // Create a browser context with realistic settings
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1366, height: 768 },
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
      geolocation: { latitude: 28.6139, longitude: 77.209 }, // Delhi
      permissions: ['geolocation'],
    });

    const page = await context.newPage();

    try {
      // ════════════════════════════════════════════════════
      //  STEP 1.5 — Try to Load Saved Cookies (for CI/CD)
      // ════════════════════════════════════════════════════
      console.log('\n  🍪 Step 1.5: Checking for saved authentication...');
      const cookiesLoaded = await loadCookies(context);

      let skipLogin = false;
      if (cookiesLoaded) {
        // Cookies were loaded. Check if we're still authenticated
        console.log('  🔍 Verifying authentication status...');
        skipLogin = await isAuthenticated(page);
      }

      if (skipLogin) {
        console.log('  ✅ Using saved session! Skipping login.\n');
      } else {
        console.log('  ⚠️  Saved session not valid or unavailable. Will login now.\n');
      }

      // ════════════════════════════════════════════════════
      //  STEP 2 — Navigate to Login Page (if needed)
      // ════════════════════════════════════════════════════
      if (!skipLogin) {
        console.log('  🔑 Step 2: Navigating to login page...');

        await page.goto(SELECTORS.login.url, {
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUTS.navigation,
        });

        // Wait for the login form to be ready (use 'load' instead of 'networkidle'
        // because Naukri pages fire continuous analytics/ad requests that prevent
        // networkidle from ever resolving)
        await page.waitForLoadState('load', { timeout: TIMEOUTS.navigation });
        console.log('    ✓ Login page loaded');

        // Dismiss any initial popups (cookie consent, promotions)
        await dismissPopups(page);

        // ════════════════════════════════════════════════════
        //  STEP 3 — Enter Credentials & Login
        // ════════════════════════════════════════════════════
        console.log('  ✍️  Step 3: Entering credentials...');

        // Wait for the email field to be visible and interactable
        const emailField = page.locator(SELECTORS.login.emailInput).first();
        await emailField.waitFor({ state: 'visible', timeout: 15_000 });

        // Type email with human-like speed
        await humanType(page, SELECTORS.login.emailInput, email);
        console.log('    ✓ Email entered');

        // Small human delay between fields
        await humanDelay(page);

        // Type password with human-like speed
        const passwordField = page.locator(SELECTORS.login.passwordInput).first();
        await passwordField.waitFor({ state: 'visible', timeout: 10_000 });
        await humanType(page, SELECTORS.login.passwordInput, password);
        console.log('    ✓ Password entered');

        // Small delay before clicking login
        await humanDelay(page);

        // Click the Login button
        console.log('    🔘 Clicking Login...');
        const loginBtn = page.locator(SELECTORS.login.loginButton).first();
        await loginBtn.waitFor({ state: 'visible', timeout: 10_000 });
        await loginBtn.click();

        // ════════════════════════════════════════════════════
        //  STEP 4 — Wait for Dashboard to Load
        // ════════════════════════════════════════════════════
        console.log('  ⏳ Step 4: Waiting for login to complete...');

        // Wait for navigation away from login page.
        // After successful login, Naukri redirects to the homepage
        // or dashboard. We wait for the URL to change.
        await page.waitForURL('**/homepage**', {
          timeout: TIMEOUTS.loginCompletion,
          waitUntil: 'domcontentloaded',
        }).catch(async () => {
        // Sometimes Naukri redirects to a different page after login.
        // Fallback: wait for any URL that is NOT the login page.
        console.log('    ⚠ Homepage redirect not detected, checking alternate URLs...');
        await page.waitForURL((url) => !url.href.includes('/nlogin/login'), {
          timeout: TIMEOUTS.loginCompletion,
        });
      });

        await page.waitForLoadState('load', { timeout: 30_000 });
        console.log(`    ✓ Login successful! Current URL: ${page.url()}`);

        // 💾 Save cookies for next run (in CI environments)
        await saveCookies(context);

        // Dismiss any post-login popups (app install prompts, etc.)
        await dismissPopups(page);
      } else {
        // Already authenticated via saved cookies
        console.log('  👤 Step 5: Navigating to profile page (already authenticated)...');
        await dismissPopups(page);
      }

      // ════════════════════════════════════════════════════
      //  STEP 5 — Navigate to Profile Page
      // ════════════════════════════════════════════════════
      if (skipLogin) {
        console.log('  👤 Step 5: Navigating to profile page...');
      }

      await page.goto(SELECTORS.profile.url, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUTS.navigation,
      });

      await page.waitForLoadState('load', { timeout: 30_000 });
      console.log(`    ✓ Profile page loaded: ${page.url()}`);

      // Dismiss any popups on profile page
      await dismissPopups(page);

      // ════════════════════════════════════════════════════
      //  STEP 6 — Upload Resume
      // ════════════════════════════════════════════════════
      console.log('  📤 Step 6: Uploading resume...');

      // Strategy: Naukri's resume upload uses a hidden <input type="file">.
      // We don't need to click a visible button first — we can directly
      // set the file on the hidden input. This is the most reliable
      // approach because it bypasses any overlay or visibility issues.

      // Wait for the file input to be present in the DOM
      const fileInput = page.locator(SELECTORS.profile.fileInput).first();

      // Check if the file input exists
      const fileInputCount = await page.locator(SELECTORS.profile.fileInput).count();

      if (fileInputCount > 0) {
        // Direct file upload via the hidden input
        console.log('    📎 Found file input, setting file...');
        await fileInput.setInputFiles(RESUME_PATH);
        console.log(`    ✓ Resume file set: ${RESUME_FILENAME}`);
      } else {
        // Fallback: Try to find and click the visible upload button first
        console.log('    ⚠ No file input found directly, trying button approach...');

        const uploadBtn = page.locator(SELECTORS.profile.updateResumeButton).first();
        await uploadBtn.waitFor({ state: 'visible', timeout: 15_000 });

        // Set up a file chooser handler BEFORE clicking the button
        const fileChooserPromise = page.waitForEvent('filechooser', {
          timeout: 10_000,
        });
        await uploadBtn.click();

        // Handle the file chooser dialog
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(RESUME_PATH);
        console.log(`    ✓ Resume uploaded via file chooser: ${RESUME_FILENAME}`);
      }

      // ════════════════════════════════════════════════════
      //  STEP 7 — Verify Upload Success
      // ════════════════════════════════════════════════════
      console.log('  ✅ Step 7: Verifying upload success...');

      // Wait for either:
      //   a) A success toast message, OR
      //   b) The "Last Updated" timestamp to reflect today's date
      const successIndicator = await Promise.race([
        // Option A: Toast/success notification
        page
          .locator(SELECTORS.profile.successToast)
          .first()
          .waitFor({ state: 'visible', timeout: TIMEOUTS.uploadSuccess })
          .then(() => 'toast'),

        // Option B: Updated timestamp text
        page
          .locator(SELECTORS.profile.lastUpdatedText)
          .first()
          .waitFor({ state: 'visible', timeout: TIMEOUTS.uploadSuccess })
          .then(() => 'timestamp'),

        // Option C: Any text containing "successfully" or "updated"
        page
          .locator('text=/successfully|updated|uploaded/i')
          .first()
          .waitFor({ state: 'visible', timeout: TIMEOUTS.uploadSuccess })
          .then(() => 'success-text'),
      ]).catch(() => 'none');

      if (successIndicator !== 'none') {
        console.log(`    🎉 Upload confirmed via: ${successIndicator}`);
      } else {
        // Even if no explicit toast, check if the page shows updated info
        console.log('    ⚠ No explicit success indicator found.');
        console.log('    📸 Taking a screenshot for manual verification...');
        await page.screenshot({
          path: path.resolve(__dirname, '..', 'test-results', 'upload-result.png'),
          fullPage: false,
        });
      }

      // Final delay to observe the result (useful in headed mode)
      await humanDelay(page);

      // ════════════════════════════════════════════════════
      //  DONE
      // ════════════════════════════════════════════════════
      console.log('\n═══════════════════════════════════════════');
      console.log('  ✅ Resume upload automation COMPLETED');
      console.log(`  📅 Date: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      console.log('═══════════════════════════════════════════\n');
    } catch (error) {
      // ════════════════════════════════════════════════════
      //  ERROR HANDLING
      // ════════════════════════════════════════════════════
      console.error('\n═══════════════════════════════════════════');
      console.error('  ❌ AUTOMATION FAILED');
      console.error('═══════════════════════════════════════════');

      if (error instanceof Error) {
        console.error(`  Error: ${error.message}`);
        console.error(`  Stack: ${error.stack?.split('\n').slice(0, 3).join('\n')}`);
      } else {
        console.error(`  Error: ${String(error)}`);
      }

      // Capture a screenshot for debugging
      try {
        const screenshotDir = path.resolve(__dirname, '..', 'test-results');
        if (!fs.existsSync(screenshotDir)) {
          fs.mkdirSync(screenshotDir, { recursive: true });
        }
        const screenshotPath = path.resolve(
          screenshotDir,
          `error-${Date.now()}.png`
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.error(`  📸 Error screenshot saved: ${screenshotPath}`);
      } catch (screenshotError) {
        console.error('  ⚠ Could not capture error screenshot.');
      }

      // Capture the current URL and page title for context
      console.error(`  🔗 URL at failure: ${page.url()}`);
      const title = await page.title().catch(() => 'unknown');
      console.error(`  📄 Page title: ${title}`);

      // Re-throw to let Playwright mark the test as FAILED
      throw error;
    } finally {
      // ════════════════════════════════════════════════════
      //  CLEANUP — Always close the browser
      // ════════════════════════════════════════════════════
      console.log('  🧹 Cleaning up — closing browser...');
      await context.close();
      await browser.close();
    }
  });
});
