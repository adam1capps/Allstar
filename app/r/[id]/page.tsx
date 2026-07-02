import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getReport } from "@/lib/store";
import { branding } from "@/lib/branding";
import { SEVERITY_LABELS, type Severity, type StoredReport } from "@/lib/report";
import PrintButton from "./PrintButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const report = await getReport(params.id);
  if (!report) return { title: "Report not found" };
  return {
    title: `${branding.product} Report — ${report.propertyAddress}`,
    robots: { index: false, follow: false },
  };
}

function formatDate(iso: string): string {
  // iso is a yyyy-mm-dd string from a date input; render without timezone drift.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}

const severityClass: Record<Severity, string> = {
  low: "bg-severity-low/10 text-severity-low border-severity-low/30",
  moderate: "bg-severity-moderate/10 text-severity-moderate border-severity-moderate/30",
  high: "bg-severity-high/10 text-severity-high border-severity-high/30",
};

export default async function ReportPage({
  params,
}: {
  params: { id: string };
}) {
  const report = await getReport(params.id);
  if (!report) notFound();

  return (
    <div className="min-h-screen bg-slate-100 py-8">
      {/* Controls (hidden when printing) */}
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-4">
        <span className="text-sm text-slate-500">
          Report ID: <code className="font-mono">{report.id}</code>
        </span>
        <PrintButton />
      </div>

      <article className="print-container mx-auto max-w-3xl bg-white px-10 py-10 shadow-sm">
        <ReportBody report={report} />
      </article>
    </div>
  );
}

function ReportBody({ report }: { report: StoredReport }) {
  return (
    <>
      {/* Header */}
      <header className="avoid-break flex items-start justify-between border-b-4 border-brand-navy pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
            {branding.company}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-brand-navy">
            {branding.reportTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{branding.tagline}</p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <p className="font-semibold text-brand-navy">{branding.product}</p>
          <p>{formatDate(report.reportDate)}</p>
        </div>
      </header>

      {/* Client & property */}
      <section className="avoid-break mt-6 grid grid-cols-2 gap-6">
        <InfoBlock label="Prepared for">
          <p className="font-semibold text-brand-ink">{report.clientName}</p>
          <p className="text-slate-600">{report.propertyAddress}</p>
          {report.clientContact && (
            <p className="text-slate-600">{report.clientContact}</p>
          )}
        </InfoBlock>
        <InfoBlock label="Inspection">
          <p className="text-slate-600">
            Inspector: <span className="text-brand-ink">{report.inspectorName}</span>
          </p>
          <p className="text-slate-600">
            Date:{" "}
            <span className="text-brand-ink">
              {formatDate(report.inspectionDate)}
            </span>
          </p>
          {report.roofType && (
            <p className="text-slate-600">
              Roof type: <span className="text-brand-ink">{report.roofType}</span>
            </p>
          )}
          {(report.roofAgeYears != null || report.roofAreaSqFt != null) && (
            <p className="text-slate-600">
              {report.roofAgeYears != null && <>Age: {report.roofAgeYears} yr </>}
              {report.roofAreaSqFt != null && (
                <>· {report.roofAreaSqFt.toLocaleString()} sq ft</>
              )}
            </p>
          )}
        </InfoBlock>
      </section>

      {/* Findings */}
      {report.findings.length > 0 && (
        <section className="mt-8">
          <SectionHeading>Findings</SectionHeading>
          <div className="mt-4 space-y-3">
            {report.findings.map((f, i) => (
              <div
                key={i}
                className="avoid-break rounded-lg border border-slate-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-brand-ink">{f.area}</h3>
                  <span
                    className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${severityClass[f.severity]}`}
                  >
                    {SEVERITY_LABELS[f.severity]}
                  </span>
                </div>
                {f.description && (
                  <p className="mt-1 text-sm text-slate-600">{f.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Photos */}
      {report.photos.length > 0 && (
        <section className="mt-8">
          <SectionHeading>Photos</SectionHeading>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {report.photos.map((p, i) => (
              <figure
                key={i}
                className="avoid-break overflow-hidden rounded-lg border border-slate-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.src}
                  alt={p.caption || `Photo ${i + 1}`}
                  className="h-48 w-full object-cover"
                />
                {p.caption && (
                  <figcaption className="bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {p.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Summary */}
      <section className="avoid-break mt-8">
        <SectionHeading>Summary</SectionHeading>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {report.summary}
        </p>
      </section>

      {/* Recommendations */}
      <section className="avoid-break mt-8">
        <SectionHeading>Recommendations</SectionHeading>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {report.recommendations}
        </p>
      </section>

      {/* Footer */}
      <footer className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
        <p>
          {branding.company} · {branding.product}
          {branding.contact.website && <> · {branding.contact.website}</>}
        </p>
        <p className="mt-1">Report ID {report.id}</p>
      </footer>
    </>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b-2 border-brand-mist pb-1 text-lg font-bold uppercase tracking-wide text-brand-navy">
      {children}
    </h2>
  );
}

function InfoBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-blue">
        {label}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  );
}
