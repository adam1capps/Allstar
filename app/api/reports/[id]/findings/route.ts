import { NextRequest, NextResponse } from "next/server";
import { isAwaitingFindings, validateFindings, type StoredReport } from "@/lib/mcscan";
import { getReport, saveReport } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A findings submission carries the diagnosis text plus up to four replacement
 * evidence photos (≤1500px JPEGs), so it is the same size class as a full
 * report — match the create/edit cap rather than a text-only limit.
 */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

/**
 * The client's one-shot findings submission.
 *
 * No builder password: possession of the unguessable report link is the
 * credential (the same trust model as viewing the report). It only works on a
 * report Regina explicitly flagged, and only until the first successful save —
 * after that the report is locked permanently.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const report = await getReport(params.id);
  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  if (!report.clientFillsFindings) {
    return NextResponse.json(
      { error: "This report does not accept findings submissions." },
      { status: 403 },
    );
  }
  if (!isAwaitingFindings(report)) {
    return NextResponse.json(
      { error: "The findings have already been submitted — this report is locked." },
      { status: 409 },
    );
  }

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Submission is too large — use fewer or smaller photos." },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Submission is too large — use fewer or smaller photos." },
        { status: 413 },
      );
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid or incomplete body." }, { status: 400 });
  }

  const { ok, errors, value } = validateFindings(body);
  if (!ok || !value) {
    return NextResponse.json({ error: "Validation failed.", errors }, { status: 400 });
  }

  const locked: StoredReport = {
    ...report,
    ...value,
    findingsSubmittedAt: new Date().toISOString(),
  };

  try {
    await saveReport(locked);
  } catch (err) {
    console.error("Failed to save findings", err);
    return NextResponse.json({ error: "Could not save findings." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path: `/r/${report.id}` });
}
