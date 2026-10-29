// api/_lib/sdReportPdf.ts
// Builds the client's report PDF: the 16-page Strategic AI Insight Report or the 21-page Executive AI Alignment Report.
// It opens the app's client-copy page (/sd-report-print or /ed-report-print) in a headless browser, hands the page the
// report's data, waits for the page to finish fitting its wording, and prints it to US Letter.

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

type Kind = { path: string; dataKey: string; readyKey: string; pages: number };
const KINDS: Record<'strategic' | 'executive', Kind> = {
  strategic: { path: '/sd-report-print', dataKey: '__SD_REPORT__', readyKey: '__SD_READY__', pages: 16 },
  executive: { path: '/ed-report-print', dataKey: '__ED_REPORT__', readyKey: '__ED_READY__', pages: 21 },
};

export async function buildSdReportPdf(data: unknown, tier: 'strategic' | 'executive' = 'strategic'): Promise<{ pdf: Buffer; overLength: number }> {
  const k = KINDS[tier] ?? KINDS.strategic;
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromiumPath(),
    headless: 'shell',
    defaultViewport: { width: 1000, height: 1300 },
  });
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument((key: string, d: unknown) => { (window as any)[key] = d; }, k.dataKey, data as any);
    await page.goto(`${APP_ORIGIN}${k.path}`, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForSelector('.pg', { timeout: 30000 });
    await page.waitForFunction(`window.${k.readyKey} === true`, { timeout: 45000 });
    const pages = await page.evaluate(() => document.querySelectorAll('.pg').length);
    if (pages !== k.pages) throw new Error(`The report page drew ${pages} pages instead of ${k.pages}.`);
    const overLength = await page.evaluate(() => document.querySelectorAll('.f.over').length);
    const pdf = await page.pdf({ width: '8.5in', height: '11in', printBackground: true, preferCSSPageSize: true });
    const buf = Buffer.from(pdf);
    // The PDF must hold every page. A short PDF is never stored or sent.
    const made = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    if (made !== k.pages) throw new Error(`The PDF came out with ${made} pages instead of ${k.pages}, so it was not sent.`);
    return { pdf: buf, overLength };
  } finally {
    await browser.close();
  }
}
