"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        background: "#C8302F",
        color: "#fff",
        border: "none",
        font: "700 12.5px 'Open Sans',sans-serif",
        padding: "10px 15px",
        borderRadius: 9,
        cursor: "pointer",
      }}
    >
      Print / Save as PDF
    </button>
  );
}
