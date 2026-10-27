// api/_lib/sdReportPdf.ts
// Builds the client's 16-page Strategic AI Insight Report PDF.
// It opens the app's client-copy page (/sd-report-print) in a headless browser, hands the page the report's data,
// waits for the page to finish fitting its wording, and prints it to US Letter.

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export const APP_ORIGIN = 'https://app.druaiconsulting.com';
const PACK_URL = 'https://github.com/Sparticuz/chromium/releases/download/v138.0.2/chromium-v138.0.2-pack.x64.tar';

async function chromiumPath(): Promise<string> {
  try {
    return await chromium.executablePath();
  } catch (err) {
    // The browser files were not bundled with the function: fetch the same release once and unpack it in /tmp.
    console.warn('[sd-report-pdf] bundled browser not found, fetching the release pack:', (err as Error)?.message);
    return await chromium.executablePath(PACK_URL);
  }
}

export async function buildSdReportPdf(data: unknown): Promise<{ pdf: Buffer; overLength: number }> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromiumPath(),
    headless: 'shell',
    defaultViewport: { width: 1000, height: 1300 },
  });
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument((d: unknown) => { (window as any).__SD_REPORT__ = d; }, data as any);
    await page.goto(`${APP_ORIGIN}/sd-report-print`, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForSelector('.pg', { timeout: 30000 });
    await page.waitForFunction('window.__SD_READY__ === true', { timeout: 45000 });
    const pages = await page.evaluate(() => document.querySelectorAll('.pg').length);
    if (pages !== 16) throw new Error(`The report page drew ${pages} pages instead of 16.`);
    const overLength = await page.evaluate(() => document.querySelectorAll('.f.over').length);
    const pdf = await page.pdf({ width: '8.5in', height: '11in', printBackground: true, preferCSSPageSize: true });
    const buf = Buffer.from(pdf);
    // The PDF must hold all 16 pages. A short PDF is never stored or sent.
    const made = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    if (made !== 16) throw new Error(`The PDF came out with ${made} pages instead of 16, so it was not sent.`);
    return { pdf: buf, overLength };
  } finally {
    await browser.close();
  }
}
