"use client";

import { useEffect, useRef, useState } from "react";
import {
  computeVals,
  defaultCaptions,
  OPTION_TITLES,
  type FindingsFields,
  type StoredReport,
} from "@/lib/mcscan";
import { renderTemplate } from "@/lib/design/render";
import { fitSheets } from "@/lib/design/fit";
import { REPORT_TPL } from "@/lib/design/embedded";

/**
 * The client's "complete the findings" experience: a fill-in panel above the
 * live report. Everything except the findings section is locked; typing
 * updates the report below in real time, and saving locks the report
 * permanently (enforced server-side).
 */

const PLACEHOLDERS: FindingsFields = {
  analysis: "— Moisture analysis to be completed —",
  diagHeadline: "— Diagnosis to be completed —",
  diagText: "",
  recommended: "Spot Dry-Out",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  border: "1px solid #D8D8DD",
  borderRadius: 8,
  font: "400 13.5px 'Open Sans',sans-serif",
  color: "#111",
  background: "#fff",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  font: "700 10.5px 'Open Sans',sans-serif",
  letterSpacing: ".05em",
  textTransform: "uppercase",
  color: "#7A7A7A",
  margin: "14px 0 5px",
};

interface PhotoDraft {
  photo1?: string;
  photo2?: string;
  photo3?: string;
  photo4?: string;
  photoCaption1?: string;
  photoCaption2?: string;
  photoCaption3?: string;
  photoCaption4?: string;
}

const PHOTO_SLOTS = [1, 2, 3, 4] as const;

export default function FindingsClient({ report }: { report: StoredReport }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [draft, setDraft] = useState<FindingsFields & PhotoDraft>({
    analysis: report.analysis || "",
    diagHeadline: report.diagHeadline || "",
    diagText: report.diagText || "",
    recommended: report.recommended || "Spot Dry-Out",
  });
  const [state, setState] = useState<
    { kind: "editing"; error?: string } | { kind: "saving" } | { kind: "confirm" }
  >({ kind: "editing" });

  function renderPreview(d: FindingsFields & PhotoDraft) {
    if (!previewRef.current) return;
    const vals = computeVals(
      {
        ...report,
        ...d,
        analysis: d.analysis || PLACEHOLDERS.analysis,
        diagHeadline: d.diagHeadline || PLACEHOLDERS.diagHeadline,
        diagText: d.diagText || PLACEHOLDERS.diagText,
        recommended: d.recommended,
      },
      { photoFallback: true },
    );
    previewRef.current.innerHTML = renderTemplate(REPORT_TPL, vals);
    fitSheets(previewRef.current);
  }

  function loadPhoto(slot: (typeof PHOTO_SLOTS)[number], file: File | null | undefined) {
    if (!file) return;
    const unreadable = () =>
      window.alert("That image couldn't be read — please use a JPG, PNG, or WebP photo.");
    if (!/^image\//.test(file.type || "")) {
      unreadable();
      return;
    }
    const fr = new FileReader();
    fr.onerror = unreadable;
    fr.onload = () => {
      const img = new Image();
      img.onerror = unreadable;
      img.onload = () => {
        const max = 1500;
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * s));
        c.height = Math.max(1, Math.round(img.height * s));
        const x = c.getContext("2d")!;
        x.fillStyle = "#fff";
        x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        update({ [`photo${slot}`]: c.toDataURL("image/jpeg", 0.82) });
      };
      img.src = fr.result as string;
    };
    fr.readAsDataURL(file);
  }

  function update(patch: Partial<FindingsFields & PhotoDraft>) {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => renderPreview(next), 250);
      return next;
    });
  }

  useEffect(() => {
    renderPreview(draft);
    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (previewRef.current) fitSheets(previewRef.current);
      });
    }
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const missing = [
    !draft.analysis.trim() && "moisture analysis",
    !draft.diagHeadline.trim() && "diagnosis headline",
    !draft.diagText.trim() && "diagnosis detail",
  ].filter(Boolean) as string[];

  async function save() {
    setState({ kind: "saving" });
    try {
      const res = await fetch(`/api/reports/${report.id}/findings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({
          kind: "editing",
          error: Array.isArray(data?.errors) && data.errors.length
            ? data.errors.join(" ")
            : data?.error || "Something went wrong — please try again.",
        });
        return;
      }
      // server now renders the locked, final report
      window.location.reload();
    } catch {
      setState({ kind: "editing", error: "Network error — please try again." });
    }
  }

  return (
    <>
      <div
        className="no-print"
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "22px 22px 26px",
          fontFamily: "'Open Sans',sans-serif",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 1px 3px rgba(17,17,17,.05), 0 8px 22px rgba(17,17,17,.06)",
            padding: "22px 24px",
          }}
        >
          <div style={{ font: "800 18px 'Exo',sans-serif", color: "#111" }}>
            Complete the findings
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#555" }}>
            Everything else in this report is finalized. Fill in the findings
            below — the report updates live — then save.{" "}
            <strong>Saving locks the report permanently.</strong>
          </p>

          <label style={labelStyle}>
            Moisture analysis
            <textarea
              rows={4}
              style={{ ...inputStyle, marginTop: 5 }}
              value={draft.analysis}
              onChange={(e) => update({ analysis: e.target.value })}
              placeholder="What the scan found, in plain language…"
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
            <label style={labelStyle}>
              Diagnosis headline
              <input
                style={{ ...inputStyle, marginTop: 5 }}
                value={draft.diagHeadline}
                onChange={(e) => update({ diagHeadline: e.target.value })}
                placeholder="e.g. Targeted dry-out recommended."
              />
            </label>
            <label style={labelStyle}>
              Recommended option
              <select
                style={{ ...inputStyle, marginTop: 5 }}
                value={draft.recommended}
                onChange={(e) => update({ recommended: e.target.value })}
              >
                {OPTION_TITLES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>

          <label style={labelStyle}>
            Diagnosis detail
            <textarea
              rows={3}
              style={{ ...inputStyle, marginTop: 5 }}
              value={draft.diagText}
              onChange={(e) => update({ diagText: e.target.value })}
              placeholder="The reasoning behind the recommendation…"
            />
          </label>

          <div style={{ ...labelStyle, marginBottom: 0 }}>
            Roof photos — optional, replaces the four report photos
          </div>
          <p style={{ margin: "3px 0 8px", fontSize: 12, color: "#9A9AA0" }}>
            Click a photo to replace it with your own; update the caption to
            match.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
          >
            {PHOTO_SLOTS.map((n) => {
              const current =
                (draft[`photo${n}` as keyof PhotoDraft] as string) ||
                report[`photo${n}` as keyof StoredReport] as string ||
                "";
              const capKey = `photoCaption${n}` as keyof PhotoDraft;
              const defaultCap =
                (report[capKey as keyof StoredReport] as string) ||
                defaultCaptions(report.roofType)[n - 1];
              return (
                <div key={n}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 92,
                      borderRadius: 10,
                      border: "2px dashed #D8B7B6",
                      background: current
                        ? `#eee url('${current}') center/cover no-repeat`
                        : "#F2F2F4",
                      cursor: "pointer",
                      overflow: "hidden",
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      loadPhoto(n, e.dataTransfer?.files?.[0]);
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        loadPhoto(n, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    {!current && (
                      <span
                        style={{
                          font: "700 10.5px 'Open Sans',sans-serif",
                          color: "#C8302F",
                          background: "rgba(255,255,255,.9)",
                          borderRadius: 6,
                          padding: "5px 9px",
                        }}
                      >
                        Photo {n}
                      </span>
                    )}
                  </label>
                  <input
                    style={{
                      width: "100%",
                      marginTop: 6,
                      padding: "6px 8px",
                      border: "1px solid #D8D8DD",
                      borderRadius: 7,
                      font: "400 11px 'Open Sans',sans-serif",
                      color: "#111",
                    }}
                    placeholder={defaultCap}
                    value={(draft[capKey] as string) ?? ""}
                    onChange={(e) => update({ [capKey]: e.target.value })}
                  />
                </div>
              );
            })}
          </div>

          {state.kind === "editing" && state.error && (
            <p
              style={{
                margin: "12px 0 0",
                padding: "9px 12px",
                borderRadius: 8,
                background: "#FDEDED",
                border: "1px solid #EBC8C8",
                fontSize: 12.5,
                color: "#8A1F1F",
              }}
            >
              {state.error}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
            <button
              onClick={() => setState({ kind: "confirm" })}
              disabled={state.kind !== "editing" || missing.length > 0}
              style={{
                background: missing.length ? "#B8BAC0" : "#00BD70",
                color: "#fff",
                border: "none",
                font: "700 13.5px 'Open Sans',sans-serif",
                padding: "12px 20px",
                borderRadius: 9,
                cursor: missing.length ? "not-allowed" : "pointer",
              }}
            >
              Save &amp; lock report
            </button>
            {missing.length > 0 && (
              <span style={{ fontSize: 12.5, color: "#7A7A7A" }}>
                Still needed: {missing.join(", ")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* live report preview */}
      <div ref={previewRef} />

      {state.kind !== "editing" && (
        <div
          className="no-print"
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
          onClick={(e) => {
            if (e.target === e.currentTarget && state.kind === "confirm")
              setState({ kind: "editing" });
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: "26px 28px",
              width: "min(440px, 90vw)",
              boxShadow: "0 18px 60px rgba(0,0,0,.3)",
            }}
          >
            <div style={{ font: "800 17px 'Exo',sans-serif", color: "#111" }}>
              {state.kind === "saving" ? "Saving…" : "Lock the report?"}
            </div>
            {state.kind === "confirm" && (
              <>
                <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "#555" }}>
                  Once saved, the findings become a permanent part of this
                  report and <strong>cannot be changed</strong>. Make sure the
                  report below looks exactly right.
                </p>
                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                  <button
                    onClick={() => void save()}
                    style={{
                      flex: 1,
                      background: "#C8302F",
                      color: "#fff",
                      border: "none",
                      font: "700 13px 'Open Sans',sans-serif",
                      padding: "11px 15px",
                      borderRadius: 9,
                      cursor: "pointer",
                    }}
                  >
                    Yes — save &amp; lock
                  </button>
                  <button
                    onClick={() => setState({ kind: "editing" })}
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
                    Keep editing
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
