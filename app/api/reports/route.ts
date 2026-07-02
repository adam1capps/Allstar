import { NextRequest, NextResponse } from "next/server";
import { generateReportId, validateReportInput, type StoredReport } from "@/lib/report";
import { saveReport } from "@/lib/store";
import { BUILDER_PASSWORD_HEADER, isBuilderAuthorized } from "@/lib/auth";

// Report bodies can include base64 photos, so run on the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isBuilderAuthorized(req.headers.get(BUILDER_PASSWORD_HEADER))) {
    return NextResponse.json(
      { error: "Not authorized. Check the builder password." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { ok, errors, value } = validateReportInput(body);
  if (!ok || !value) {
    return NextResponse.json({ error: "Validation failed.", errors }, { status: 400 });
  }

  // createdAt is stamped server-side (Date is unavailable in some sandboxes but
  // fine in the Netlify/Node runtime).
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
