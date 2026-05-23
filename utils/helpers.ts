import { Page, BrowserContext } from 'playwright';
import { SELECTORS, TIMEOUTS } from './selectors';
import fs from 'fs';
import path from 'path';

/**
 * ═══════════════════════════════════════════════════════════════
 * Helper Utilities for Naukri Automation
 * ═══════════════════════════════════════════════════════════════
 */

// ── Cookie Storage Configuration ──────────────────────────────
const COOKIES_DIR = path.resolve(__dirname, '..', '.cache');
const COOKIES_FILE = path.join(COOKIES_DIR, 'naukri-auth.json');

/**
 * Generate a random delay between min and max milliseconds.
 * Used to mimic human interaction timing and reduce bot detection risk.
 */
export function randomDelay(
  min: number = TIMEOUTS.humanDelay.min,
  max: number = TIMEOUTS.humanDelay.max
): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Wait for a random human-like delay.
 * This is one of the FEW places where waitForTimeout is acceptable —
 * it's specifically to simulate human pace and dodge anti-bot heuristics.
 */
export async function humanDelay(page: Page): Promise<void> {
  const delay = randomDelay();
  console.log(`    ⏳ Human delay: ${delay}ms`);
  await page.waitForTimeout(delay);
}

/**
 * Dismiss any promotional popups, overlays, cookie banners, or
 * app-download prompts that Naukri may show at any point.
 *
 * Strategy: iterate through known close-button selectors and click
 * whichever is visible. Non-blocking — if none found, silently continues.
 */
export async function dismissPopups(page: Page): Promise<void> {
  // Short wait for potential overlays to render
  await page.waitForTimeout(TIMEOUTS.overlayDelay);

  for (const selector of SELECTORS.popups.closeButtons) {
    try {
      const closeBtn = page.locator(selector).first();
      if (await closeBtn.isVisible({ timeout: 1000 })) {
        await closeBtn.click({ timeout: 2000 });
        console.log(`    ✖ Dismissed popup via: ${selector}`);
        // Brief pause after dismissal for DOM to settle
        await page.waitForTimeout(500);
      }
    } catch {
      // Selector not found or not clickable — that's fine, move on
    }
  }
}

/**
 * Type text into a field character by character with random delays.
 * This mimics human typing speed and helps bypass keystroke analysis.
 */
export async function humanType(
  page: Page,
  selector: string,
  text: string
): Promise<void> {
  const field = page.locator(selector).first();
  await field.click();
  // Clear any existing text
  await field.fill('');
  // Type character by character with small random delays
  for (const char of text) {
    await field.pressSequentially(char, {
      delay: randomDelay(50, 200),
    });
  }
}

/**
 * ════════════════════════════════════════════════════════════════
 * COOKIE PERSISTENCE FUNCTIONS (for CI/CD environments)
 * ════════════════════════════════════════════════════════════════
 *
 * Strategy: Save authenticated cookies locally after successful login.
 * In GitHub Actions (or any CI), load these cookies to skip OTP.
 *
 * ⚠️  IMPORTANT:
 *  - Cookies expire every 24-48 hours, so they need periodic refresh
 *  - GitHub Actions may still reject cookies due to IP mismatch
 *  - If OTP prompt appears even with valid cookies, refresh locally
 *    and re-run the GitHub Action
 */

/**
 * Save browser context cookies to a local file after successful login.
 * Call this AFTER login is confirmed in local runs.
 */
export async function saveCookies(context: BrowserContext): Promise<void> {
  try {
    // Ensure .cache directory exists
    if (!fs.existsSync(COOKIES_DIR)) {
      fs.mkdirSync(COOKIES_DIR, { recursive: true });
    }

    // Extract all cookies from the context
    const cookies = await context.cookies();

    // Save to file with timestamp
    const data = {
      savedAt: new Date().toISOString(),
      cookies,
    };

    fs.writeFileSync(COOKIES_FILE, JSON.stringify(data, null, 2));
    console.log(`\n  💾 Cookies saved to: ${COOKIES_FILE}`);
    console.log(`  📅 Timestamp: ${data.savedAt}`);
  } catch (error) {
    console.error('  ❌ Failed to save cookies:', error);
  }
}

/**
 * Load previously saved cookies into the browser context.
 * Call this BEFORE navigating to Naukri in CI environments.
 *
 * Returns: true if cookies were loaded successfully, false otherwise
 */
export async function loadCookies(context: BrowserContext): Promise<boolean> {
  try {
    if (!fs.existsSync(COOKIES_FILE)) {
      console.log(`  ⚠️  No saved cookies found at: ${COOKIES_FILE}`);
      return false;
    }

    const data = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
    const { savedAt, cookies } = data;

    // Check if cookies are older than 24 hours
    const savedTime = new Date(savedAt).getTime();
    const currentTime = new Date().getTime();
    const ageHours = (currentTime - savedTime) / (1000 * 60 * 60);

    if (ageHours > 24) {
      console.log(
        `  ⚠️  Cookies are ${ageHours.toFixed(1)} hours old (> 24h). They may be expired.`
      );
      console.log('  💡 Consider running the test locally to refresh cookies.');
    }

    // Restore cookies into the context
    await context.addCookies(cookies);
    console.log(`  ✓ Restored ${cookies.length} cookies from: ${COOKIES_FILE}`);
    console.log(`  📅 Originally saved: ${savedAt}`);
    return true;
  } catch (error) {
    console.error('  ❌ Failed to load cookies:', error);
    return false;
  }
}

/**
 * Check if Naukri user is already authenticated (has valid session).
 * Useful to skip login if cookies are still valid.
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Try to navigate to profile page
    // If redirected to login, cookies are invalid
    const response = await page.goto(SELECTORS.profile.url, {
      waitUntil: 'domcontentloaded',
      timeout: 10_000,
    });

    // Check if we're still on the profile page (not redirected to login)
    const currentUrl = page.url();
    const isOnProfile =
      currentUrl.includes('/mnjuser/profile') ||
      currentUrl.includes('/naukri.com/mnjuser/profile');

    if (isOnProfile) {
      console.log('  ✓ Authentication valid! Already logged in.');
      return true;
    } else {
      console.log('  ⚠️  Not authenticated. Login required.');
      return false;
    }
  } catch (error) {
    console.log('  ⚠️  Authentication check failed:', error);
    return false;
  }
}

