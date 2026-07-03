import { getStore } from "@netlify/blobs";
import type { StoredReport } from "./mcscan";

/**
 * Report persistence backed by Netlify Blobs.
 *
 * On Netlify (production and `netlify dev`) Blobs is configured automatically.
 * For a plain `next dev` run outside the Netlify CLI, we fall back to an
 * in-memory store so the app is still runnable locally — data there is not
 * durable and resets on restart (fine for form/preview testing).
 */

const STORE_NAME = "reports";

// Module-level fallback map (per server process).
const memory = new Map<string, StoredReport>();

function blobsAvailable(): boolean {
  // Netlify injects these at runtime; when absent we use the memory fallback.
  return Boolean(
    process.env.NETLIFY ||
      process.env.NETLIFY_BLOBS_CONTEXT ||
      process.env.NETLIFY_SITE_ID,
  );
}

export async function saveReport(report: StoredReport): Promise<void> {
  if (blobsAvailable()) {
    const store = getStore(STORE_NAME);
    await store.setJSON(report.id, report);
    return;
  }
  memory.set(report.id, report);
}

export async function getReport(id: string): Promise<StoredReport | null> {
  if (blobsAvailable()) {
    // Strong consistency matters: the findings endpoint's lock check reads a
    // report that may have been written moments earlier by another function
    // invocation — an eventually-consistent read could miss the lock and let
    // a second submission through.
    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    const data = (await store.get(id, { type: "json" })) as StoredReport | null;
    return data ?? null;
  }
  return memory.get(id) ?? null;
}

/** Newest-first list of all stored reports (for the builder's Reports page). */
export async function listReports(): Promise<StoredReport[]> {
  let reports: StoredReport[];
  if (blobsAvailable()) {
    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    const { blobs } = await store.list();
    reports = (
      await Promise.all(
        blobs.map(
          async (b) => (await store.get(b.key, { type: "json" })) as StoredReport | null,
        ),
      )
    ).filter((r): r is StoredReport => r != null);
  } else {
    reports = [...memory.values()];
  }
  return reports.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

// ---------------------------------------------------------------------------
// Generated-PDF cache (reports are immutable once final, so cache forever)
// ---------------------------------------------------------------------------

const PDF_STORE = "report-pdfs";
const pdfMemory = new Map<string, Buffer>();

export async function getCachedPdf(key: string): Promise<Buffer | null> {
  if (blobsAvailable()) {
    const store = getStore(PDF_STORE);
    const data = await store.get(key, { type: "arrayBuffer" });
    return data ? Buffer.from(data) : null;
  }
  return pdfMemory.get(key) ?? null;
}

export async function cachePdf(key: string, pdf: Buffer): Promise<void> {
  if (blobsAvailable()) {
    const store = getStore(PDF_STORE);
    const bytes = new Uint8Array(pdf);
    await store.set(key, new Blob([bytes]));
    return;
  }
  pdfMemory.set(key, pdf);
}
