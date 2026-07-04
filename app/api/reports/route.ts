import { NextRequest, NextResponse } from "next/server";
import {
  generateReportId,
  isAwaitingFindings,
  validateMcScanData,
  type StoredReport,
} from "@/lib/mcscan";
import { listReports, saveReport } from "@/lib/store";
import { BUILDER_PASSWORD_HEADER, isBuilderAuthorized } from "@/lib/auth";

// Report bodies include base64 photos, so run on the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Six ≤1500px JPEGs plus text comfortably fit; anything bigger is abuse. */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

/** Report index for the builder's Reports page (metadata only, no photos). */
export async function GET(req: NextRequest) {
  if (!isBuilderAuthorized(req.headers.get(BUILDER_PASSWORD_HEADER))) {
    return NextResponse.json(
      { error: "Not authorized. Check the builder password." },
      { status: 401 },
    );
  }
  const reports = await listReports();
  return NextResponse.json({
    reports: reports.map((r) => ({
      id: r.id,
      buildingName: r.buildingName,
      address: r.address,
      scanDate: r.scanDate,
      preparedFor: r.preparedFor,
      createdAt: r.createdAt,
      awaitingFindings: isAwaitingFindings(r),
      findingsSubmittedAt: r.findingsSubmittedAt ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!isBuilderAuthorized(req.headers.get(BUILDER_PASSWORD_HEADER))) {
    return NextResponse.json(
      { error: "Not authorized. Check the builder password." },
      { status: 401 },
    );
  }

  // Reject oversized payloads from the declared length before buffering the
  // body; the post-read check backstops requests without a Content-Length.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Report is too large — use fewer or smaller photos." },
      { status: 413 },
    );
  }
  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Report is too large — use fewer or smaller photos." },
        { status: 413 },
      );
    }
    body = JSON.parse(raw);
  } catch {
    // covers both a truncated/aborted body stream and malformed JSON
    return NextResponse.json({ error: "Invalid or incomplete body." }, { status: 400 });
  }

  const clientFillsFindings =
    (body as Record<string, unknown> | null)?.clientFillsFindings === true;

  const { ok, errors, value } = validateMcScanData(body, {
    findingsOptional: clientFillsFindings,
  });
  if (!ok || !value) {
    return NextResponse.json({ error: "Validation failed.", errors }, { status: 400 });
  }

  const report: StoredReport = {
    ...value,
    id: generateReportId(),
    createdAt: new Date().toISOString(),
    ...(clientFillsFindings ? { clientFillsFindings: true } : {}),
  };

  try {
    await saveReport(report);
  } catch (err) {
    console.error("Failed to save report", err);
    return NextResponse.json({ error: "Could not save report." }, { status: 500 });
  }

  return NextResponse.json({ id: report.id, path: `/r/${report.id}` }, { status: 201 });
}
