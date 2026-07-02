import type { Metadata } from "next";
import {
  FONTS_CSS,
  BASE_CSS,
  PRINT_FIX_CSS,
  BUILDER_TPL,
  REPORT_TPL,
} from "@/lib/design/embedded";
import BuilderClient from "./BuilderClient";

export const metadata: Metadata = {
  title: "MC Scan Report Generator — Allstar",
  robots: { index: false, follow: false },
};

export default function BuilderPage() {
  return (
    <div className="print-page-root" style={{ background: "#F3F3F5", minHeight: "100vh" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: FONTS_CSS + "\n" + BASE_CSS + "\n" + PRINT_FIX_CSS,
        }}
      />
      <BuilderClient builderTpl={BUILDER_TPL} reportTpl={REPORT_TPL} />
    </div>
  );
}
