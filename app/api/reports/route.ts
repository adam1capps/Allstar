import { NextRequest, NextResponse } from "next/server";
import { generateReportId, validateMcScanData, type StoredReport } from "@/lib/mcscan";
import { saveReport } from "@/lib/store";
import { BUILDER_PASSWORD_HEADER, isBuilderAuthorized } from "@/lib/auth";

// Report bodies include base64 photos, so run on the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Six ≤1500px JPEGs plus text comfortably fit; anything bigger is abuse. */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!isBuilderAuthorized(req.headers.get(BUILDER_PASSWORD_HEADER))) {
    return NextResponse.json(
      { error: "Not authorized. Check the builder password." },
      { status: 401 },
    );
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Report is too large — use fewer or smaller photos." },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { ok, errors, value } = validateMcScanData(body);
  if (!ok || !value) {
    return NextResponse.json({ error: "Validation failed.", errors }, { status: 400 });
  }

  const report: StoredReport = {
    ...value,
    id: generateReportId(),
    createdAt: new Date().toISOString(),
  };

  try {
    await saveReport(report);
  } catch (err) {
    console.error("Failed to save report", err);
    return NextResponse.json({ error: "Could not save report." }, { status: 500 });
  }

  return NextResponse.json({ id: report.id, path: `/r/${report.id}` }, { status: 201 });
}
