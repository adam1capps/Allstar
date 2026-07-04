import type { Metadata } from "next";
import ReportsClient from "./ReportsClient";

export const metadata: Metadata = {
  title: "Reports — MC Scan Report Generator",
  robots: { index: false, follow: false },
};

export default function ReportsPage() {
  return <ReportsClient />;
}
