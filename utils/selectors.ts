/**
 * ═══════════════════════════════════════════════════════════════
 * Naukri.com DOM Selectors — Centralized Configuration
 * ═══════════════════════════════════════════════════════════════
 *
 * Naukri frequently changes their DOM structure. By isolating all
 * selectors here, we can update them in ONE place when the UI
 * changes, without touching the test logic.
 *
 * Priority Order for selector strategies:
 *   1. getByRole / getByText / getByLabel  (most resilient)
 *   2. data-* attributes                   (stable if present)
 *   3. ID selectors                        (moderately stable)
 *   4. CSS class selectors                 (least stable — avoid)
 */

export const SELECTORS = {
  // ── Login Page ──────────────────────────────────────────────
  login: {
    url: 'https://www.naukri.com/nlogin/login',
    // Primary: ID selectors (most stable)
    emailInput: '#usernameField',
    passwordInput: '#passwordField',
    loginButton: 'button[type="submit"]',
    // Fallback: placeholder-based selectors
    emailInputFallback: 'input[placeholder="Enter Email ID / Username"]',
    passwordInputFallback: 'input[placeholder="Enter Password"]',
    loginButtonFallback: 'button:has-text("Login")',
  },

  // ── Dashboard / Post-Login ─────────────────────────────────
  dashboard: {
    url: 'https://www.naukri.com/mnjuser/homepage',
    profileIcon: '.nI-gNb-drawer__icon',
    viewProfileLink: 'a:has-text("View profile")',
  },

  // ── Profile / Resume Section ───────────────────────────────
  profile: {
    url: 'https://www.naukri.com/mnjuser/profile',
    // The resume widget area
    resumeWidgetHeading: 'text=Resume',
    // The file input is usually hidden; we target it directly
    fileInput: 'input[type="file"]',
    // Visible upload/update buttons (text may vary)
    updateResumeButton: 'text=/Update resume|Upload Resume|Attach Resume/i',
    // Success indicators
    successToast: '.toastMsg, .toast-message, [class*="toast"]',
    lastUpdatedText: 'text=/Uploaded on|Last updated|Resume updated/i',
  },

  // ── Common Overlays / Popups ───────────────────────────────
  popups: {
    // Promotional popups, cookie banners, app-download prompts
    closeButtons: [
      'button[title="Close"]',
      '.close-btn',
      '[class*="crossIcon"]',
      '[class*="CloseIcon"]',
      'button:has-text("Not now")',
      'button:has-text("Maybe later")',
      'button:has-text("Skip")',
      '[class*="modal"] button[class*="close"]',
    ],
  },
} as const;

export const TIMEOUTS = {
  /** Max wait for page navigation */
  navigation: 60_000,
  /** Max wait for login completion */
  loginCompletion: 30_000,
  /** Max wait for resume upload success */
  uploadSuccess: 30_000,
  /** Short delay to mimic human behavior (anti-bot) */
  humanDelay: { min: 1000, max: 3000 },
  /** Delay after page loads to let overlays render */
  overlayDelay: 3000,
} as const;
