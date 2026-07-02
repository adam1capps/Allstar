import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MC Scan Report Generator — Allstar",
  description:
    "Build an Allstar MC Scan moisture report and generate a permanent shareable link.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
