/**
 * Rate limiting tra navigazioni Playwright.
 * Aspetta 800-2000ms per rispettare i server del MinGiustizia.
 * @param {import('playwright').Page} page
 */
export async function rateLimit(page) {
  await page.waitForTimeout(800 + Math.random() * 1200);
}
