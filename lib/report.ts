import { customAlphabet } from "nanoid";

/**
 * Domain model for an Allstar Roof MRI report.
 *
 * This is a first-pass "standard" structure. It is intentionally centralized so
 * that when the real Roof MRI report sample is provided, fields/sections can be
 * adjusted here and both the builder form and the viewer follow along.
 *
 * The later Roof MRI App / Allstar Chart integration should produce this same
 * shape and POST it to /api/reports, so it plugs into the exact same viewer.
 */

export type Severity = "low" | "moderate" | "high";

export interface ReportPhoto {
  /** Data URL (base64) or hosted URL of the image. */
  src: string;
  caption?: string;
}

export interface Finding {
  area: string; // e.g. "North slope", "Chimney flashing"
  severity: Severity;
  description: string;
}

export interface ReportInput {
  // Client & property
  clientName: string;
  propertyAddress: string;
  clientContact?: string; // email or phone (for the client's reference, not used to send)
  reportDate: string; // ISO date (yyyy-mm-dd)

  // Inspection details
  inspectorName: string;
  inspectionDate: string; // ISO date
  roofType?: string; // e.g. "Asphalt shingle", "TPO", "Metal"
  roofAgeYears?: number;
  roofAreaSqFt?: number;

  // Body
  findings: Finding[];
  photos: ReportPhoto[];
  summary: string;
  recommendations: string;
}

export interface StoredReport extends ReportInput {
  id: string;
  createdAt: string; // ISO timestamp
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

/**
 * URL-safe, unguessable id. 12 chars from a 32-char alphabet ~ 60 bits of
 * entropy — collision-safe and not enumerable, which is what makes the shared
 * report link safe to hand to a client.
 */
const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuv", 12);

export function generateReportId(): string {
  return nanoid();
}

/** Basic server-side validation of a submitted report payload. */
export function validateReportInput(data: unknown): {
  ok: boolean;
  errors: string[];
  value?: ReportInput;
} {
  const errors: string[] = [];
  const d = (data ?? {}) as Record<string, unknown>;

  const requireString = (key: keyof ReportInput, label: string) => {
    const v = d[key];
    if (typeof v !== "string" || v.trim() === "") {
      errors.push(`${label} is required.`);
      return "";
    }
    return v.trim();
  };

  const clientName = requireString("clientName", "Client name");
  const propertyAddress = requireString("propertyAddress", "Property address");
  const reportDate = requireString("reportDate", "Report date");
  const inspectorName = requireString("inspectorName", "Inspector name");
  const inspectionDate = requireString("inspectionDate", "Inspection date");
  const summary = requireString("summary", "Summary");
  const recommendations = requireString("recommendations", "Recommendations");

  const findings: Finding[] = Array.isArray(d.findings)
    ? (d.findings as unknown[])
        .map((f) => f as Record<string, unknown>)
        .filter((f) => typeof f.area === "string" && (f.area as string).trim() !== "")
        .map((f) => ({
          area: String(f.area).trim(),
          severity: (["low", "moderate", "high"].includes(String(f.severity))
            ? f.severity
            : "low") as Severity,
          description: typeof f.description === "string" ? f.description.trim() : "",
        }))
    : [];

  const photos: ReportPhoto[] = Array.isArray(d.photos)
    ? (d.photos as unknown[])
        .map((p) => p as Record<string, unknown>)
        .filter((p) => typeof p.src === "string" && (p.src as string).length > 0)
        .map((p) => ({
          src: String(p.src),
          caption: typeof p.caption === "string" ? p.caption.trim() : undefined,
        }))
    : [];

  if (errors.length > 0) return { ok: false, errors };

  const value: ReportInput = {
    clientName,
    propertyAddress,
    clientContact:
      typeof d.clientContact === "string" ? d.clientContact.trim() : undefined,
    reportDate,
    inspectorName,
    inspectionDate,
    roofType: typeof d.roofType === "string" ? d.roofType.trim() : undefined,
    roofAgeYears:
      typeof d.roofAgeYears === "number" && !Number.isNaN(d.roofAgeYears)
        ? d.roofAgeYears
        : undefined,
    roofAreaSqFt:
      typeof d.roofAreaSqFt === "number" && !Number.isNaN(d.roofAreaSqFt)
        ? d.roofAreaSqFt
        : undefined,
    findings,
    photos,
    summary,
    recommendations,
  };

  return { ok: true, errors: [], value };
}
