import type { Metadata } from "next";
import "./globals.css";
import { branding } from "@/lib/branding";

export const metadata: Metadata = {
  title: `${branding.company} ${branding.product} Report Builder`,
  description: `Generate ${branding.company} ${branding.product} reports and permanent shareable links.`,
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
