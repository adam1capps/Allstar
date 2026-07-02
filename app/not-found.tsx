import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold text-brand-navy">Report not found</h1>
      <p className="mt-3 text-slate-600">
        This report link is invalid or the report no longer exists.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-slate"
      >
        Go home
      </Link>
    </main>
  );
}
