import { getStore } from "@netlify/blobs";
import type { StoredReport } from "./report";

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
    const store = getStore(STORE_NAME);
    const data = (await store.get(id, { type: "json" })) as StoredReport | null;
    return data ?? null;
  }
  return memory.get(id) ?? null;
}
