import Link from "next/link";
import { branding } from "@/lib/branding";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-blue">
        {branding.company}
      </p>
      <h1 className="text-4xl font-bold text-brand-navy sm:text-5xl">
        {branding.product} Report Builder
      </h1>
      <p className="mt-4 max-w-xl text-lg text-slate-600">
        Create a {branding.product} inspection report and get a permanent,
        shareable link to send to the client.
      </p>
      <Link
        href="/builder"
        className="mt-8 inline-flex items-center rounded-lg bg-brand-navy px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-slate"
      >
        Create a report →
      </Link>
      <p className="mt-10 text-sm text-slate-400">
        Reports are generated here — this app does not send anything.
      </p>
    </main>
  );
}
