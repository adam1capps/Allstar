import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/design/allstar-logo.png"
        alt="Allstar"
        className="mb-6 h-20 w-auto"
      />
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#C8302F]">
        Allstar
      </p>
      <h1 className="text-4xl font-bold text-neutral-900 sm:text-5xl">
        MC Scan Report Generator
      </h1>
      <p className="mt-4 max-w-xl text-lg text-slate-600">
        Build an MC Scan moisture report and get a permanent, shareable link to
        send to the client.
      </p>
      <Link
        href="/builder"
        className="mt-8 inline-flex items-center rounded-lg bg-[#C8302F] px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#A52529]"
      >
        Open the report builder →
      </Link>
      <p className="mt-10 text-sm text-slate-400">
        Reports are generated here — this app does not send anything.
      </p>
    </main>
  );
}
