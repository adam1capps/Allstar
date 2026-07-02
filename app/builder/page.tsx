"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { branding } from "@/lib/branding";
import type { Finding, ReportPhoto, Severity } from "@/lib/report";

type PhotoDraft = ReportPhoto & { name: string };

const SEVERITIES: Severity[] = ["low", "moderate", "high"];

const emptyFinding = (): Finding => ({ area: "", severity: "low", description: "" });

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function BuilderPage() {
  // Client & property
  const [clientName, setClientName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [reportDate, setReportDate] = useState("");

  // Inspection
  const [inspectorName, setInspectorName] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");
  const [roofType, setRoofType] = useState("");
  const [roofAgeYears, setRoofAgeYears] = useState("");
  const [roofAreaSqFt, setRoofAreaSqFt] = useState("");

  // Body
  const [findings, setFindings] = useState<Finding[]>([emptyFinding()]);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [summary, setSummary] = useState("");
  const [recommendations, setRecommendations] = useState("");

  // Auth + submission state
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const origin = useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    [],
  );

  function updateFinding(index: number, patch: Partial<Finding>) {
    setFindings((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );
  }

  function removeFinding(index: number) {
    setFindings((prev) => prev.filter((_, i) => i !== index));
  }

  async function handlePhotoFiles(fileList: FileList | null) {
    if (!fileList) return;
    const drafts: PhotoDraft[] = [];
    for (const file of Array.from(fileList)) {
      const src = await fileToDataUrl(file);
      drafts.push({ src, caption: "", name: file.name });
    }
    setPhotos((prev) => [...prev, ...drafts]);
  }

  function updatePhotoCaption(index: number, caption: string) {
    setPhotos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, caption } : p)),
    );
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setResultUrl(null);

    const payload = {
      clientName,
      propertyAddress,
      clientContact: clientContact || undefined,
      reportDate,
      inspectorName,
      inspectionDate,
      roofType: roofType || undefined,
      roofAgeYears: roofAgeYears ? Number(roofAgeYears) : undefined,
      roofAreaSqFt: roofAreaSqFt ? Number(roofAreaSqFt) : undefined,
      findings: findings.filter((f) => f.area.trim() !== ""),
      photos: photos.map(({ src, caption }) => ({ src, caption })),
      summary,
      recommendations,
    };

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-builder-password": password,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.errors?.length
            ? data.errors.join(" ")
            : data?.error || "Something went wrong.",
        );
        return;
      }
      setResultUrl(`${origin}${data.path}`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    if (!resultUrl) return;
    await navigator.clipboard.writeText(resultUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (resultUrl) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-brand-navy">Report created ✓</h1>
          <p className="mt-2 text-slate-600">
            Here is the permanent link to send to the client:
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <input
              readOnly
              value={resultUrl}
              className="flex-1 bg-transparent text-sm text-slate-700 outline-none"
            />
            <button
              onClick={copyLink}
              className="rounded-md bg-brand-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-slate"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="mt-6 flex gap-3">
            <a
              href={resultUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-brand-navy px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-mist"
            >
              Open report
            </a>
            <button
              onClick={() => {
                setResultUrl(null);
                setCopied(false);
              }}
              className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-slate"
            >
              Create another
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">
            {branding.company} · {branding.product}
          </p>
          <h1 className="text-2xl font-bold text-brand-navy">New report</h1>
        </div>
        <Link href="/" className="text-sm text-slate-500 hover:text-brand-navy">
          ← Home
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Section title="Client & property">
          <Field label="Client name" required>
            <input
              className={inputCls}
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
          </Field>
          <Field label="Property address" required>
            <input
              className={inputCls}
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              required
            />
          </Field>
          <Field label="Client contact (email or phone)">
            <input
              className={inputCls}
              value={clientContact}
              onChange={(e) => setClientContact(e.target.value)}
            />
          </Field>
          <Field label="Report date" required>
            <input
              type="date"
              className={inputCls}
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              required
            />
          </Field>
        </Section>

        <Section title="Inspection details">
          <Field label="Inspector name" required>
            <input
              className={inputCls}
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              required
            />
          </Field>
          <Field label="Inspection date" required>
            <input
              type="date"
              className={inputCls}
              value={inspectionDate}
              onChange={(e) => setInspectionDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Roof type">
            <input
              className={inputCls}
              placeholder="e.g. Asphalt shingle, TPO, Metal"
              value={roofType}
              onChange={(e) => setRoofType(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Roof age (years)">
              <input
                type="number"
                min={0}
                className={inputCls}
                value={roofAgeYears}
                onChange={(e) => setRoofAgeYears(e.target.value)}
              />
            </Field>
            <Field label="Roof area (sq ft)">
              <input
                type="number"
                min={0}
                className={inputCls}
                value={roofAreaSqFt}
                onChange={(e) => setRoofAreaSqFt(e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Findings"
          action={
            <button
              type="button"
              onClick={() => setFindings((p) => [...p, emptyFinding()])}
              className="text-sm font-semibold text-brand-blue hover:underline"
            >
              + Add finding
            </button>
          }
        >
          {findings.map((f, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  className={inputCls}
                  placeholder="Area (e.g. North slope, Chimney flashing)"
                  value={f.area}
                  onChange={(e) => updateFinding(i, { area: e.target.value })}
                />
                <select
                  className={inputCls}
                  value={f.severity}
                  onChange={(e) =>
                    updateFinding(i, { severity: e.target.value as Severity })
                  }
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)} severity
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                className={`${inputCls} mt-3`}
                rows={2}
                placeholder="Description of the finding"
                value={f.description}
                onChange={(e) =>
                  updateFinding(i, { description: e.target.value })
                }
              />
              {findings.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeFinding(i)}
                  className="mt-2 text-xs font-medium text-severity-high hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </Section>

        <Section title="Photos">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handlePhotoFiles(e.target.files)}
            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-brand-navy file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-slate"
          />
          {photos.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {photos.map((p, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.src}
                    alt={p.name}
                    className="h-28 w-full object-cover"
                  />
                  <div className="p-2">
                    <input
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                      placeholder="Caption"
                      value={p.caption ?? ""}
                      onChange={(e) => updatePhotoCaption(i, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="mt-1 text-xs text-severity-high hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Summary & recommendations">
          <Field label="Summary" required>
            <textarea
              className={inputCls}
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
            />
          </Field>
          <Field label="Recommendations / next steps" required>
            <textarea
              className={inputCls}
              rows={4}
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              required
            />
          </Field>
        </Section>

        <Section title="Authorization">
          <Field label="Builder password">
            <input
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Required if configured for this site"
            />
          </Field>
        </Section>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-navy px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-slate disabled:opacity-60"
        >
          {submitting ? "Generating…" : "Generate report & link"}
        </button>
      </form>
    </main>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20";

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-brand-navy">{title}</h2>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-severity-high"> *</span>}
      </span>
      {children}
    </label>
  );
}
