"use client";

import { useEffect, useRef, useState } from "react";
import { computeVals, SAMPLE, type McScanData } from "@/lib/mcscan";
import { renderTemplate } from "@/lib/design/render";
import { fitSheets } from "@/lib/design/fit";
import { BASE_CSS, PRINT_FIX_CSS, BUILDER_TPL, REPORT_TPL } from "@/lib/design/embedded";

/**
 * Client runtime for the MC Scan builder.
 *
 * The form and the live report preview are the design's own templates,
 * rendered into innerHTML containers. The form is rendered ONCE (so typing
 * never loses focus); field edits update a mutable job object and:
 *   - refresh the small computed stats via [data-live] spans
 *   - toggle photo-clear buttons via [data-if]
 *   - update photo drop-zone backgrounds directly
 *   - re-render the report preview, debounced
 *
 * All interactivity is event delegation on data-key / data-action attributes
 * (the embed step stripped the design's template event handlers).
 */

const LIVE_KEYS = [
  "wetPct",
  "dampPct",
  "dryPct",
  "undPct",
  "calcTotSq",
  "calcTotSF",
  "combinedPct",
] as const;

const PHOTO_KEYS = ["coverPhoto", "overlayImg", "photo1", "photo2", "photo3", "photo4"] as const;
type PhotoKey = (typeof PHOTO_KEYS)[number];
const IF_FOR_PHOTO: Record<PhotoKey, string> = {
  coverPhoto: "hasCover",
  overlayImg: "hasOverlay",
  photo1: "hasP1",
  photo2: "hasP2",
  photo3: "hasP3",
  photo4: "hasP4",
};
const BG_FOR_PHOTO: Record<PhotoKey, string> = {
  coverPhoto: "coverBg",
  overlayImg: "overlayBg",
  photo1: "p1Bg",
  photo2: "p2Bg",
  photo3: "p3Bg",
  photo4: "p4Bg",
};

const STORAGE_KEY = "mcScanData";
const PASSWORD_KEY = "builderPassword";

export default function BuilderClient() {
  const formRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const jobRef = useRef<Partial<McScanData>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [dialog, setDialog] = useState<
    | { kind: "closed" }
    | { kind: "password"; error?: string; busy?: boolean; sampleFields?: string[] }
    | { kind: "link"; url: string; copied?: boolean }
  >({ kind: "closed" });
  const passwordRef = useRef<HTMLInputElement>(null);

  /** Fields still carrying the untouched sample-job content — a real report
   *  should not silently ship another building's data. */
  function untouchedSampleFields(): string[] {
    const job = { ...SAMPLE, ...jobRef.current };
    const labels: Array<[keyof McScanData, string]> = [
      ["buildingName", "building name"],
      ["address", "address"],
      ["preparedFor", "prepared for"],
      ["inspector", "inspector"],
      ["analysis", "moisture analysis"],
      ["diagText", "diagnosis detail"],
      ["coverPhoto", "cover photo"],
      ["overlayImg", "overlay map"],
      ["photo1", "photo 1"],
      ["photo2", "photo 2"],
      ["photo3", "photo 3"],
      ["photo4", "photo 4"],
    ];
    return labels
      .filter(([key]) => job[key] === SAMPLE[key] && SAMPLE[key] !== "")
      .map(([, label]) => label);
  }

  // ------------------------------------------------------------------ render

  function renderPreview() {
    if (!previewRef.current) return;
    const vals = computeVals(jobRef.current as McScanData, { photoFallback: true });
    previewRef.current.innerHTML = renderTemplate(REPORT_TPL, vals);
    fitSheets(previewRef.current);
  }

  function schedulePreview() {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // autosave rides the same debounce — serializing a photo-heavy job on
      // every keystroke would stall typing
      save();
      renderPreview();
    }, 250);
  }

  function refreshComputed() {
    const root = formRef.current;
    if (!root) return;
    const vals = computeVals(jobRef.current as McScanData);
    root.querySelectorAll<HTMLElement>("[data-live]").forEach((el) => {
      el.textContent = String(vals[el.dataset.live as string] ?? "");
    });
    for (const key of PHOTO_KEYS) {
      const zone = root.querySelector<HTMLElement>(`label[data-key="${key}"]`);
      if (zone) zone.style.background = String(vals[BG_FOR_PHOTO[key]]);
      root
        .querySelectorAll<HTMLElement>(`[data-if="${IF_FOR_PHOTO[key]}"]`)
        .forEach((el) => {
          el.style.display = vals[IF_FOR_PHOTO[key]] ? "" : "none";
        });
    }
  }

  /** Full form render — mount, reset, and job-load only (typing never re-renders). */
  function renderForm() {
    const root = formRef.current;
    if (!root) return;
    const vals = computeVals(jobRef.current as McScanData);
    // stats become live spans (app-generated markup — safe as raw)
    const rawKeys = new Set<string>(LIVE_KEYS);
    for (const k of LIVE_KEYS) {
      const text = String(vals[k]).replace(/&/g, "&amp;").replace(/</g, "&lt;");
      vals[k] = `<span data-live="${k}">${text}</span>`;
    }
    root.innerHTML = renderTemplate(BUILDER_TPL, vals, { rawKeys });
    // selects don't honor value="" attributes in raw HTML
    root.querySelectorAll<HTMLSelectElement>("select[data-key]").forEach((sel) => {
      const key = sel.dataset.key as keyof McScanData;
      sel.value = String(vals[`f_${key}`] ?? "");
    });
    refreshComputed();
  }

  // ------------------------------------------------------------------- state

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobRef.current));
    } catch {
      /* photo-heavy jobs can exceed the localStorage quota — links still work */
    }
  }

  function setField(key: string, value: string) {
    (jobRef.current as Record<string, unknown>)[key] = value;
    refreshComputed();
    schedulePreview(); // also persists (debounced)
  }

  function setJob(job: Partial<McScanData>) {
    jobRef.current = job;
    save();
    renderForm();
    renderPreview();
  }

  function loadImage(key: string, file: File | null | undefined) {
    if (!file) return;
    const unreadable = () =>
      window.alert(
        "That image couldn't be read — please use a JPG, PNG, or WebP photo.",
      );
    if (!/^image\//.test(file.type || "")) {
      unreadable();
      return;
    }
    const fr = new FileReader();
    fr.onerror = unreadable;
    fr.onload = () => {
      const img = new Image();
      // e.g. HEIC passes the MIME test but the browser can't decode it —
      // without this the drop would silently do nothing
      img.onerror = unreadable;
      img.onload = () => {
        // same compression as the design: ≤1500px JPEG q0.82
        const max = 1500;
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * s));
        c.height = Math.max(1, Math.round(img.height * s));
        const x = c.getContext("2d")!;
        x.fillStyle = "#fff";
        x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        setField(key, c.toDataURL("image/jpeg", 0.82));
      };
      img.src = fr.result as string;
    };
    fr.readAsDataURL(file);
  }

  // ----------------------------------------------------------------- actions

  function downloadJob() {
    const blob = new Blob([JSON.stringify(jobRef.current, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      (jobRef.current.buildingName || "mc-scan-job")
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase()
        .replace(/^-|-$/g, "") + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  function loadJob(file: File | null | undefined) {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const u = JSON.parse(String(fr.result));
        if (u && typeof u === "object") setJob(u);
      } catch {
        /* ignore malformed job files */
      }
    };
    fr.readAsText(file);
  }

  function resetAll() {
    if (!window.confirm("Clear this job and restore the sample content?")) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setJob({});
  }

  const imgToData = (src: string) =>
    fetch(src)
      .then((r) => r.blob())
      .then(
        (b) =>
          new Promise<string>((res) => {
            const f = new FileReader();
            f.onload = () => res(String(f.result));
            f.onerror = () => res(src);
            f.readAsDataURL(b);
          }),
      )
      .catch(() => src);

  /** Standalone single-file report export (ported from the design). */
  async function downloadReport() {
    const node = previewRef.current?.querySelector(".mcreport");
    if (!node) return;
    const clone = node.cloneNode(true) as HTMLElement;
    const live = node.querySelectorAll("img");
    const cim = clone.querySelectorAll("img");
    for (let i = 0; i < live.length; i++) {
      const du = await imgToData(live[i].currentSrc || live[i].src);
      cim[i].setAttribute("src", du);
    }
    // Reuse the app's own print CSS so the exported file paginates exactly
    // like the live report. Fonts come from Google's CDN because the export
    // must be a single self-contained file (self-hosted font paths would
    // break once the file leaves the site).
    const css = BASE_CSS + "\n" + PRINT_FIX_CSS;
    const title = (jobRef.current.buildingName || "MC Scan Report")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const html =
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' +
      title +
      ' — MC Scan Report</title><link href="https://fonts.googleapis.com/css2?family=Exo:wght@600;700;800&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet"><style>' +
      css +
      "</style></head><body>" +
      clone.outerHTML +
      "</body></html>";
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "") +
      "-mc-scan-report.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  async function createLink(password: string) {
    const sampleFields = untouchedSampleFields();
    setDialog({ kind: "password", busy: true, sampleFields });
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-builder-password": password,
        },
        body: JSON.stringify({ ...SAMPLE, ...jobRef.current }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDialog({
          kind: "password",
          sampleFields,
          error: Array.isArray(data?.errors) && data.errors.length
            ? data.errors.join(" ")
            : data?.error || "Something went wrong.",
        });
        return;
      }
      try {
        sessionStorage.setItem(PASSWORD_KEY, password);
      } catch {}
      setDialog({ kind: "link", url: `${window.location.origin}${data.path}` });
    } catch {
      setDialog({
        kind: "password",
        sampleFields,
        error: "Network error — please try again.",
      });
    }
  }

  // ------------------------------------------------------------------- mount

  useEffect(() => {
    // job from ?job= (base64url JSON, as the design supported), else localStorage
    let initial: Partial<McScanData> = {};
    try {
      const q = new URLSearchParams(window.location.search).get("job");
      if (q) {
        const j = JSON.parse(
          decodeURIComponent(
            escape(atob(q.replace(/-/g, "+").replace(/_/g, "/"))),
          ),
        );
        if (j && typeof j === "object") initial = j;
      }
    } catch {}
    if (Object.keys(initial).length === 0) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const p = JSON.parse(raw);
          if (p && typeof p === "object") initial = p;
        }
      } catch {}
    }
    jobRef.current = initial;
    renderForm();
    renderPreview();
    // web fonts change metrics — re-fit the preview once they settle
    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (previewRef.current) fitSheets(previewRef.current);
      });
    }

    const root = formRef.current;
    if (!root) return;

    const onInputOrChange = (e: Event) => {
      const t = e.target as HTMLElement;
      if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement)) return;
      if (t instanceof HTMLInputElement && t.type === "file") {
        if (e.type !== "change") return;
        if (t.dataset.action === "loadJob") {
          loadJob(t.files?.[0]);
        } else if (t.dataset.key) {
          loadImage(t.dataset.key, t.files?.[0]);
        }
        t.value = "";
        return;
      }
      if (t.dataset.key) setField(t.dataset.key, t.value);
    };

    const onClick = (e: Event) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(
        "button[data-action], button[data-key]",
      );
      if (!el) return;
      const action = el.dataset.action;
      if (action === "print") window.print();
      else if (action === "downloadReport") void downloadReport();
      else if (action === "downloadJob") downloadJob();
      else if (action === "resetAll") resetAll();
      else if (action === "createLink") {
        setDialog({ kind: "password", sampleFields: untouchedSampleFields() });
      } else if (el.dataset.key) {
        // photo ✕ clear button
        e.preventDefault();
        e.stopPropagation();
        setField(el.dataset.key, "");
      }
    };

    const onDragOver = (e: DragEvent) => {
      if ((e.target as HTMLElement).closest("label[data-key]")) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      const zone = (e.target as HTMLElement).closest<HTMLElement>("label[data-key]");
      if (!zone) return;
      e.preventDefault();
      loadImage(zone.dataset.key!, e.dataTransfer?.files?.[0]);
    };

    root.addEventListener("input", onInputOrChange);
    root.addEventListener("change", onInputOrChange);
    root.addEventListener("click", onClick);
    root.addEventListener("dragover", onDragOver);
    root.addEventListener("drop", onDrop);
    return () => {
      root.removeEventListener("input", onInputOrChange);
      root.removeEventListener("change", onInputOrChange);
      root.removeEventListener("click", onClick);
      root.removeEventListener("dragover", onDragOver);
      root.removeEventListener("drop", onDrop);
      clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------ dialog

  const overlay =
    dialog.kind === "closed" ? null : (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: "rgba(17,17,17,.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Open Sans',sans-serif",
        }}
        className="no-print"
        onClick={(e) => {
          if (e.target === e.currentTarget) setDialog({ kind: "closed" });
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "26px 28px",
            width: "min(460px, 90vw)",
            boxShadow: "0 18px 60px rgba(0,0,0,.3)",
          }}
        >
          {dialog.kind === "password" ? (
            <>
              <div style={{ font: "800 17px 'Exo',sans-serif", color: "#111" }}>
                Create shareable link
              </div>
              <p style={{ margin: "8px 0 14px", fontSize: 13, color: "#555" }}>
                This saves the report and returns a permanent link you can send
                to the client.
              </p>
              {!!dialog.sampleFields?.length && (
                <p
                  style={{
                    margin: "0 0 14px",
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "#FFF6E5",
                    border: "1px solid #F0D9A8",
                    fontSize: 12.5,
                    color: "#7A5A12",
                  }}
                >
                  Heads up — these still contain the sample job's content:{" "}
                  <strong>{dialog.sampleFields.join(", ")}</strong>. The client
                  will see them exactly as shown in the preview.
                </p>
              )}
              <input
                ref={passwordRef}
                type="password"
                placeholder="Builder password"
                defaultValue={
                  typeof window !== "undefined"
                    ? sessionStorage.getItem(PASSWORD_KEY) ?? ""
                    : ""
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !dialog.busy)
                    void createLink(passwordRef.current?.value ?? "");
                }}
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #D8D8DD",
                  borderRadius: 8,
                  font: "400 14px 'Open Sans',sans-serif",
                }}
              />
              {dialog.error && (
                <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#C8302F" }}>
                  {dialog.error}
                </p>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button
                  onClick={() => void createLink(passwordRef.current?.value ?? "")}
                  disabled={dialog.busy}
                  style={{
                    flex: 1,
                    background: "#00BD70",
                    color: "#fff",
                    border: "none",
                    font: "700 13px 'Open Sans',sans-serif",
                    padding: "11px 15px",
                    borderRadius: 9,
                    cursor: "pointer",
                    opacity: dialog.busy ? 0.6 : 1,
                  }}
                >
                  {dialog.busy ? "Creating…" : "Create link"}
                </button>
                <button
                  onClick={() => setDialog({ kind: "closed" })}
                  style={{
                    background: "#EFEFF1",
                    color: "#111",
                    border: "none",
                    font: "600 13px 'Open Sans',sans-serif",
                    padding: "11px 15px",
                    borderRadius: 9,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ font: "800 17px 'Exo',sans-serif", color: "#111" }}>
                Permanent link created ✓
              </div>
              <p style={{ margin: "8px 0 12px", fontSize: 13, color: "#555" }}>
                Send this link to the client — it opens the report and prints to
                PDF.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  background: "#F6F6F8",
                  border: "1px solid #E3E3E5",
                  borderRadius: 8,
                  padding: "8px 10px",
                }}
              >
                <input
                  readOnly
                  value={dialog.url}
                  onFocus={(e) => e.currentTarget.select()}
                  style={{
                    flex: 1,
                    border: "none",
                    background: "transparent",
                    font: "400 12.5px 'Open Sans',sans-serif",
                    color: "#333",
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(dialog.url);
                    setDialog({ ...dialog, copied: true });
                    setTimeout(
                      () => setDialog((d) => (d.kind === "link" ? { ...d, copied: false } : d)),
                      1800,
                    );
                  }}
                  style={{
                    background: "#C8302F",
                    color: "#fff",
                    border: "none",
                    font: "700 12px 'Open Sans',sans-serif",
                    padding: "8px 12px",
                    borderRadius: 7,
                    cursor: "pointer",
                    flex: "none",
                  }}
                >
                  {dialog.copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <a
                  href={dialog.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: 1,
                    textAlign: "center",
                    background: "#111",
                    color: "#fff",
                    font: "700 13px 'Open Sans',sans-serif",
                    padding: "11px 15px",
                    borderRadius: 9,
                    textDecoration: "none",
                  }}
                >
                  Open report
                </a>
                <button
                  onClick={() => setDialog({ kind: "closed" })}
                  style={{
                    background: "#EFEFF1",
                    color: "#111",
                    border: "none",
                    font: "600 13px 'Open Sans',sans-serif",
                    padding: "11px 15px",
                    borderRadius: 9,
                    cursor: "pointer",
                  }}
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );

  return (
    <>
      <div ref={formRef} />
      <div ref={previewRef} />
      {overlay}
    </>
  );
}
