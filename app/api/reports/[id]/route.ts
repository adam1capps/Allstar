import { NextRequest, NextResponse } from "next/server";
import {
  isAwaitingFindings,
  validateMcScanData,
  type StoredReport,
} from "@/lib/mcscan";
import { getReport, saveReport } from "@/lib/store";
import { BUILDER_PASSWORD_HEADER, isBuilderAuthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024 * 1024;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const report = await getReport(params.id);
  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  return NextResponse.json(report);
}

/**
 * Edit an existing report (password-gated). The permanent link and its id are
 * unchanged — clients keep the URL they were sent; the PDF regenerates from
 * the updated content. The client-findings lock is about the client's
 * one-shot submission; the password holder can always correct a report.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isBuilderAuthorized(req.headers.get(BUILDER_PASSWORD_HEADER))) {
    return NextResponse.json(
      { error: "Not authorized. Check the builder password." },
      { status: 401 },
    );
  }

  const existing = await getReport(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

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
    return NextResponse.json({ error: "Invalid or incomplete body." }, { status: 400 });
  }

  const clientFillsFindings =
    (body as Record<string, unknown> | null)?.clientFillsFindings === true;

  // findings may stay blank only while the client is still expected to fill them
  const { ok, errors, value } = validateMcScanData(body, {
    findingsOptional: clientFillsFindings && !existing.findingsSubmittedAt,
  });
  if (!ok || !value) {
    return NextResponse.json({ error: "Validation failed.", errors }, { status: 400 });
  }

  const updated: StoredReport = {
    ...value,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    ...(clientFillsFindings ? { clientFillsFindings: true } : {}),
    ...(existing.findingsSubmittedAt
      ? { findingsSubmittedAt: existing.findingsSubmittedAt }
      : {}),
  };

  try {
    await saveReport(updated);
  } catch (err) {
    console.error("Failed to update report", err);
    return NextResponse.json({ error: "Could not save report." }, { status: 500 });
  }

  return NextResponse.json({
    id: updated.id,
    path: `/r/${updated.id}`,
    awaitingFindings: isAwaitingFindings(updated),
  });
}
