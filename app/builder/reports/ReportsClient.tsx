"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Regina's report index: every created report with its status, permanent
 * link, and — once final — the PDF to save into the client's folder.
 */

interface ReportRow {
  id: string;
  buildingName: string;
  address: string;
  scanDate: string;
  preparedFor: string;
  createdAt: string;
  awaitingFindings: boolean;
  findingsSubmittedAt: string | null;
}

const PASSWORD_KEY = "builderPassword";

export default function ReportsClient() {
  const [password, setPassword] = useState("");
  const [state, setState] = useState<
    | { kind: "auth"; error?: string; busy?: boolean }
    | { kind: "loaded"; reports: ReportRow[] }
  >({ kind: "auth" });

  async function load(pw: string) {
    setState({ kind: "auth", busy: true });
    try {
      const res = await fetch("/api/reports", {
        headers: { "x-builder-password": pw },
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "auth", error: data?.error || "Something went wrong." });
        return;
      }
      try {
        sessionStorage.setItem(PASSWORD_KEY, pw);
      } catch {}
      setState({ kind: "loaded", reports: data.reports });
    } catch {
      setState({ kind: "auth", error: "Network error — please try again." });
    }
  }

  useEffect(() => {
    // auto-load when the builder password is already in this session
    let pw = "";
    try {
      pw = sessionStorage.getItem(PASSWORD_KEY) ?? "";
    } catch {}
    if (pw) {
      setPassword(pw);
      void load(pw);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        padding: "34px 22px 60px",
        fontFamily: "'Open Sans',system-ui,sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/design/allstar-logo.png" alt="Allstar" style={{ height: 34 }} />
        <div style={{ marginRight: "auto" }}>
          <h1 style={{ font: "800 22px 'Exo',system-ui,sans-serif", color: "#111", margin: 0 }}>
            Reports
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#7A7A7A" }}>
            Every created report — open the link or download the PDF for the
            client's folder.
          </p>
        </div>
        <Link
          href="/builder"
          style={{
            background: "#C8302F",
            color: "#fff",
            font: "700 12.5px 'Open Sans',sans-serif",
            padding: "10px 15px",
            borderRadius: 9,
            textDecoration: "none",
          }}
        >
          ← Builder
        </Link>
      </div>

      {state.kind === "auth" ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 1px 3px rgba(17,17,17,.05), 0 8px 22px rgba(17,17,17,.06)",
            padding: "22px 24px",
            maxWidth: 420,
          }}
        >
          <label style={{ display: "block", font: "700 10.5px 'Open Sans',sans-serif", letterSpacing: ".05em", textTransform: "uppercase", color: "#7A7A7A", marginBottom: 6 }}>
            Builder password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !state.busy) void load(password);
            }}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #D8D8DD", borderRadius: 8, font: "400 14px 'Open Sans',sans-serif" }}
          />
          {state.error && (
            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#C8302F" }}>{state.error}</p>
          )}
          <button
            onClick={() => void load(password)}
            disabled={state.busy}
            style={{ marginTop: 14, background: "#C8302F", color: "#fff", border: "none", font: "700 13px 'Open Sans',sans-serif", padding: "11px 18px", borderRadius: 9, cursor: "pointer", opacity: state.busy ? 0.6 : 1 }}
          >
            {state.busy ? "Loading…" : "View reports"}
          </button>
        </div>
      ) : state.reports.length === 0 ? (
        <p style={{ color: "#7A7A7A" }}>No reports yet — create one in the builder.</p>
      ) : (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(17,17,17,.05), 0 8px 22px rgba(17,17,17,.06)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1fr 1fr 1.4fr", background: "#FBEDEC", padding: "11px 0" }}>
            {["Building", "Prepared for", "Scan date", "Status", ""].map((h, i) => (
              <div key={i} style={{ padding: "0 16px", font: "700 9px 'Open Sans',sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "#C8302F" }}>
                {h}
              </div>
            ))}
          </div>
          {state.reports.map((r) => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1fr 1fr 1.4fr", alignItems: "center", borderTop: "1px solid #EFEFF1", padding: "12px 0" }}>
              <div style={{ padding: "0 16px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{r.buildingName}</div>
                <div style={{ fontSize: 11, color: "#9A9AA0" }}>{r.address}</div>
              </div>
              <div style={{ padding: "0 16px", fontSize: 12.5, color: "#333" }}>{r.preparedFor}</div>
              <div style={{ padding: "0 16px", fontSize: 12.5, color: "#333" }}>{r.scanDate}</div>
              <div style={{ padding: "0 16px" }}>
                <span
                  style={{
                    font: "700 10px 'Open Sans',sans-serif",
                    letterSpacing: ".05em",
                    textTransform: "uppercase",
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: r.awaitingFindings ? "#FFF3D6" : "#E9F9F1",
                    color: r.awaitingFindings ? "#8a6a0e" : "#0d7a4d",
                  }}
                >
                  {r.awaitingFindings ? "Awaiting findings" : "Final"}
                </span>
              </div>
              <div style={{ padding: "0 16px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <a
                  href={`/builder?edit=${r.id}`}
                  style={{ font: "700 12px 'Open Sans',sans-serif", color: "#111", background: "#EFEFF1", padding: "7px 12px", borderRadius: 8, textDecoration: "none" }}
                >
                  Edit
                </a>
                <a
                  href={`/r/${r.id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ font: "700 12px 'Open Sans',sans-serif", color: "#111", background: "#EFEFF1", padding: "7px 12px", borderRadius: 8, textDecoration: "none" }}
                >
                  Open
                </a>
                {!r.awaitingFindings && (
                  <a
                    href={`/r/${r.id}/pdf`}
                    style={{ font: "700 12px 'Open Sans',sans-serif", color: "#fff", background: "#C8302F", padding: "7px 12px", borderRadius: 8, textDecoration: "none" }}
                  >
                    PDF
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
