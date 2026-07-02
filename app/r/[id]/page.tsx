import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getReport } from "@/lib/store";
import { computeVals, isAwaitingFindings } from "@/lib/mcscan";
import { renderTemplate } from "@/lib/design/render";
import { FONTS_CSS, BASE_CSS, PRINT_FIX_CSS, REPORT_TPL } from "@/lib/design/embedded";
import PrintButton from "./PrintButton";
import FitSheets from "./FitSheets";
import FindingsClient from "./FindingsClient";

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
    title: `${report.buildingName} — MC Scan Report`,
    robots: { index: false, follow: false },
  };
}

export default async function ReportPage({
  params,
}: {
  params: { id: string };
}) {
  const report = await getReport(params.id);
  if (!report) notFound();

  const awaiting = isAwaitingFindings(report);

  return (
    <div
      className="print-page-root"
      style={{ background: "#d7d7db", minHeight: "100vh" }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: FONTS_CSS + "\n" + BASE_CSS + "\n" + PRINT_FIX_CSS,
        }}
      />

      {/* Floating controls — hidden when printing */}
      <div
        className="no-print"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 22px",
          background: "rgba(30,30,34,.97)",
          color: "#fff",
          boxShadow: "0 2px 14px rgba(0,0,0,.2)",
          fontFamily: "'Open Sans',sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/design/allstar-logo.png"
          alt="Allstar"
          style={{ height: 30, width: "auto", display: "block" }}
        />
        <div style={{ lineHeight: 1.15, marginRight: "auto" }}>
          <div
            style={{
              fontFamily: "'Exo',sans-serif",
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            MC Scan Moisture Report
          </div>
          <div style={{ fontSize: 10.5, color: "#B9B9C0" }}>
            {report.buildingName} · {report.scanDate}
          </div>
        </div>
        {awaiting ? (
          <span
            style={{
              background: "#E0A10A",
              color: "#111",
              font: "700 11.5px 'Open Sans',sans-serif",
              letterSpacing: ".06em",
              textTransform: "uppercase",
              padding: "7px 13px",
              borderRadius: 999,
            }}
          >
            Findings needed
          </span>
        ) : (
          <PrintButton />
        )}
      </div>

      {awaiting ? (
        // The findings panel renders (and live-updates) the report itself.
        <FindingsClient report={report} />
      ) : (
        <>
          <div
            dangerouslySetInnerHTML={{
              __html: renderTemplate(
                REPORT_TPL,
                computeVals(report, { photoFallback: true }),
              ),
            }}
          />
          <FitSheets />
        </>
      )}
    </div>
  );
}
