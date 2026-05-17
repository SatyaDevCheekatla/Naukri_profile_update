import { Page } from 'playwright';
import { SELECTORS, TIMEOUTS } from './selectors';

/**
 * ═══════════════════════════════════════════════════════════════
 * Helper Utilities for Naukri Automation
 * ═══════════════════════════════════════════════════════════════
 */

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
