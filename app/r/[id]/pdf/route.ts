import { NextRequest, NextResponse } from "next/server";
import { isAwaitingFindings } from "@/lib/mcscan";
import { getReport, getCachedPdf, cachePdf } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// PDF generation launches headless Chromium — give it room.
export const maxDuration = 26;

/**
 * The actual PDF file for a report — what Allstar saves into the client's
 * folder. Rendered by headless Chromium exactly like "Print / Save as PDF"
 * (one Letter page per sheet), then cached in Blobs: reports are immutable
 * once final, so generation happens once per report.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const report = await getReport(params.id);
  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  if (isAwaitingFindings(report)) {
    return NextResponse.json(
      { error: "This report is awaiting the client's findings — the PDF is available once it is completed." },
      { status: 409 },
    );
  }

  const filename =
    (report.buildingName || "mc-scan-report")
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()
      .replace(/^-|-$/g, "") + "-mc-scan-report.pdf";
  const headers = {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${filename}"`,
    "cache-control": "private, max-age=3600",
  };

  // the key tracks every content change (edits, findings lock) → stale PDFs
  // are never served and unchanged reports render only once
  const stamp = (report.updatedAt || "") + (report.findingsSubmittedAt || "") + report.createdAt;
  const cacheKey = `${report.id}-${stamp.replace(/[^0-9]/g, "")}`;
  const cached = await getCachedPdf(cacheKey);
  if (cached) {
    return new NextResponse(new Uint8Array(cached), { headers });
  }

  try {
    const pdf = await renderPdf(new URL(`/r/${report.id}`, req.nextUrl.origin).toString());
    await cachePdf(cacheKey, pdf).catch(() => {});
    return new NextResponse(new Uint8Array(pdf), { headers });
  } catch (err) {
    console.error("PDF generation failed", err);
    return NextResponse.json(
      { error: "PDF generation failed — please try again in a moment." },
      { status: 503 },
    );
  }
}

async function renderPdf(url: string): Promise<Buffer> {
  const puppeteer = (await import("puppeteer-core")).default;

  // Local/dev chromium if provided; otherwise the serverless build.
  let executablePath = process.env.CHROMIUM_PATH;
  let args: string[] = ["--no-sandbox", "--disable-setuid-sandbox"];
  if (!executablePath) {
    const chromium = (await import("@sparticuz/chromium")).default;
    executablePath = await chromium.executablePath();
    args = chromium.args;
  }

  const browser = await puppeteer.launch({
    executablePath,
    args,
    headless: true,
    defaultViewport: { width: 900, height: 1200 },
  });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 15000 });
    await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready);
    // let the shrink-to-fit pass settle after fonts
    await new Promise((r) => setTimeout(r, 400));
    const pdf = await page.pdf({
      format: "letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
