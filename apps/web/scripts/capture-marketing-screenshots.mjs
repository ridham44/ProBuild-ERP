/**
 * Captures the product screenshots used on the public home page from a running demo environment.
 *
 *   pnpm --filter @probuild/web screenshots:marketing
 *
 * Needs the web app (BASE_URL, default http://localhost:3000) backed by an API seeded with
 * `prisma:seed:demo-data`, and the demo account from src/features/marketing/demo.ts.
 * Re-run it whenever the screens shown on the home page change, so the page never shows a stale UI.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.DEMO_EMAIL ?? 'admin@probuild.local';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo@Pass1234';
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/marketing');

/** `open` is a list page plus the link text of the seeded document to open from it. */
const SHOTS = [
  { file: 'project-financial.jpg', open: ['/projects', 'PRJ-2026-001'], tab: 'financial' },
  { file: 'requisition-approval.jpg', open: ['/procurement/requests', 'PR-2026-00001'] },
  { file: 'rfq-comparison.jpg', open: ['/procurement/rfqs', 'RFQ-2026-00001'], tab: 'comparison' },
  { file: 'goods-receipt-qc.jpg', open: ['/inventory/receipts', 'GRN-2026-00001'] },
  { file: 'stock.jpg', open: ['/inventory/stock'] },
  { file: 'project-materials.jpg', open: ['/projects', 'PRJ-2026-001'], tab: 'materials' },
];

/** Signs in through the same-origin API proxy, so the session cookie lands in the browser context. */
async function signIn(page) {
  const response = await page.request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
    timeout: 180_000,
  });
  if (!response.ok()) throw new Error(`Demo sign-in failed with HTTP ${response.status()}`);
}

async function openShot(page, shot) {
  const [listPath, linkText] = shot.open;
  await page.goto(`${BASE_URL}${listPath}`, { waitUntil: 'networkidle' });
  if (linkText) {
    // Rows link with client-side navigation, so wait for the URL rather than a page load.
    await page.getByRole('link', { name: linkText, exact: true }).first().click();
    await page.waitForURL((url) => url.pathname !== listPath);
  }
  if (shot.tab) {
    const url = new URL(page.url());
    url.searchParams.set('tab', shot.tab);
    await page.goto(url.toString(), { waitUntil: 'networkidle' });
  }
  // Wait for loading skeletons to resolve, then give charts a moment to settle.
  await page.waitForFunction(() => document.querySelectorAll('.animate-shimmer').length === 0);
  await page.waitForTimeout(800);
}

/** A dev server that recompiles mid-navigation can abort a page load, so each screen gets a few attempts. */
async function withRetries(label, action, attempts = 3) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      if (attempt >= attempts) throw error;
      console.warn(`retrying ${label} (attempt ${attempt} failed: ${error instanceof Error ? error.message.split('\n')[0] : error})`);
    }
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1.25,
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  // A dev server compiles each route on its first visit, which can take well over the default 30s.
  page.setDefaultTimeout(180_000);
  // The Next.js dev indicator is not part of the product.
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = 'nextjs-portal { display: none !important; }';
    document.addEventListener('DOMContentLoaded', () => document.head.append(style));
  });

  await withRetries('sign-in', () => signIn(page));
  for (const shot of SHOTS) {
    await withRetries(shot.file, () => openShot(page, shot));
    await page.screenshot({ path: path.join(OUT_DIR, shot.file), type: 'jpeg', quality: 82 });
    console.log(`captured ${shot.file}`);
  }
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
