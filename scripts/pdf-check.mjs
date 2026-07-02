/**
 * PDF quality check: renders a report URL to PDF exactly the way a client's
 * "Print / Save as PDF" does (headless Chromium), then verifies:
 *   - PDF page count === number of report sheets (no blank/overflow pages)
 *   - no sheet's content exceeds its single Letter page (816×1056)
 *
 * Usage: node scripts/pdf-check.mjs <report-url> [out.pdf]
 */
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { writeFileSync } from "node:fs";

const url = process.argv[2];
const out = process.argv[3] || "report.pdf";
if (!url) {
  console.error("usage: node scripts/pdf-check.mjs <report-url> [out.pdf]");
  process.exit(2);
}

const browser = await chromium.launch({
  // Use the environment's chromium when the exact playwright build is absent.
  executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium",
});
const page = await browser.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);

await page.emulateMedia({ media: "print" });
const geometry = await page.evaluate(() => {
  const SHEET_H = 1056;
  const sheets = [...document.querySelectorAll("[data-sheet]")];
  // Real rendered content bottom vs the page edge. (scrollHeight is not used
  // here: clipped zero-paint descendants inflate it without affecting print.)
  const overflow = (sheet) => {
    const rect = sheet.getBoundingClientRect();
    let bottom = rect.top;
    for (const child of sheet.children) {
      const r = child.getBoundingClientRect();
      if (r.bottom > bottom) bottom = r.bottom;
    }
    return Math.max(bottom - (rect.top + SHEET_H), 0);
  };
  return {
    sheets: sheets.length,
    overflowing: sheets
      .map((s, i) => ({ i: i + 1, over: Math.round(overflow(s)) }))
      .filter((x) => x.over > 1),
  };
});
await page.emulateMedia({ media: null }); // clear override — pdf() must use real print media

const pdf = await page.pdf({
  format: "Letter",
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
writeFileSync(out, pdf);
const pages = (await PDFDocument.load(pdf)).getPageCount();

console.log(`sheets on page:    ${geometry.sheets}`);
console.log(`pdf pages:         ${pages}`);
console.log(`pdf bytes:         ${pdf.length}`);
if (geometry.overflowing.length) {
  console.log(
    "OVERFLOWING SHEETS:",
    geometry.overflowing.map((x) => `#${x.i} (+${x.over}px)`).join(", "),
  );
}
const ok = pages === geometry.sheets && geometry.overflowing.length === 0;
console.log(ok ? "OK — one clean page per sheet" : "FAIL — pagination broken");

await browser.close();
process.exit(ok ? 0 : 1);
