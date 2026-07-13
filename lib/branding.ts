/**
 * Report branding profiles.
 *
 * The MC Scan report design (lib/design/report.html) is contractor-neutral in
 * everything but its *brand chrome*: the logo/wordmark, the name + tagline in
 * the running header, the footer line, the contact block, the back-cover copy,
 * and the single accent color. Those literals used to be hardcoded to Allstar.
 *
 * This module lifts them into a `Brand` object so the same engine renders:
 *   - `allstar`  — the Allstar account's report, byte-for-byte as before.
 *   - `roofmri`  — the generic Roof MRI report every other contractor runs on.
 *
 * A report picks its brand via the optional `brand` field on McScanData
 * (validated against BRAND_KEYS). Brandless reports — every historical Allstar
 * report, and Allstar's own builder which never sends the field — resolve to
 * DEFAULT_BRAND, which stays `allstar` so nothing about Allstar's output moves.
 * The Roof MRI app sends `brand: "roofmri"` explicitly. A future Roof-MRI-first
 * deployment can flip the default with the DEFAULT_REPORT_BRAND env var.
 *
 * Only the moisture *data* palette (wet #F01F1F / damp #FFD84D / dry #00BD70)
 * is off-limits here — color there means state, not brand, so it never varies.
 */

export interface BrandCredential {
  k: string;
  v: string;
}

export interface Brand {
  /** Stable key — also the value stored on the report's `brand` field. */
  key: string;
  /** Running-header wordmark text (e.g. "ALLSTAR" / "ROOF MRI"). */
  name: string;
  /** Running-header sub-line under the wordmark. */
  tagline: string;
  /** Short provider name — "Why owners trust {companyShort}". */
  companyShort: string;
  /** Provider name on the cover's "Prepared By" line. */
  companyName: string;
  /** Short product badge — cover chip, cover title, running-header right. */
  badge: string;
  /** Product name inside body prose ("{scanName} is delivered using…"). */
  scanName: string;
  /** Footer running line, repeated on every interior sheet. */
  footer: string;
  /** Back-cover closing blurb. */
  closing: string;
  /** Back-cover technology line. */
  techline: string;
  /** Logo mark image (running header, cover + back-cover corners, watermark). */
  logo: string;
  /** Full wordmark image (cover top bar, back-cover panel). */
  wordmark: string;
  /** Contact tile image (the CTA sheet's QR / contact square). */
  qr: string;
  /** Alt text for the contact tile. */
  qrAlt: string;
  /** Contact phone (or website) on the CTA + back cover. */
  phone: string;
  /** Contact rep / team name on the CTA + back cover. */
  repName: string;
  /** Brand accent — chrome only; the data palette never uses it. */
  accent: string;
  /** Soft accent tint (icon tiles, hairline fills). */
  accentSoft: string;
  /** Accent-shadow RGB triple ("r,g,b") — per-shadow alpha stays in the CSS. */
  accentRgb: string;
  /** The four "Why owners trust" credential cells. */
  credentials: BrandCredential[];
}

const allstar: Brand = {
  key: "allstar",
  name: "ALLSTAR",
  tagline: "ROOFING · SHEET METAL · EXTERIORS",
  companyShort: "Allstar",
  companyName: "Allstar Construction",
  badge: "MC Scan",
  scanName: "MC Scan",
  footer: "MC Scan · Roof Moisture Diagnostic · Allstar Construction",
  closing:
    "A diagnosis you can trust, from a roofing partner that’s been doing this since 1979. We map the moisture, show you the evidence, and recommend only what the roof needs.",
  techline: "MC SCAN · POWERED BY ROOF MRI™ TECHNOLOGY",
  logo: "/design/allstar-logo.png",
  wordmark: "/design/allstar-wordmark.jpg",
  qr: "/design/qr-code.png",
  qrAlt: "Scan to contact Allstar",
  phone: "515.520.7774",
  repName: "Dane",
  accent: "#C8302F",
  accentSoft: "#FBEDEC",
  accentRgb: "158,34,38",
  credentials: [
    { k: "Serving since", v: "1979" },
    { k: "In business", v: "45+ years" },
    { k: "Certification", v: "Elevate / Firestone & Gaco Coatings" },
    { k: "Status", v: "Licensed · Bonded · Insured" },
  ],
};

const roofmri: Brand = {
  key: "roofmri",
  name: "ROOF MRI",
  tagline: "MOISTURE DIAGNOSTICS",
  companyShort: "Roof MRI",
  companyName: "Roof MRI",
  badge: "Roof MRI",
  scanName: "The Roof MRI scan",
  footer: "Roof MRI · Roof Moisture Diagnostic",
  closing:
    "A diagnosis you can trust. Roof MRI maps the moisture, shows you the evidence, and recommends only what the roof actually needs — square by square.",
  techline: "ROOF MRI™ · MOISTURE DIAGNOSTIC TECHNOLOGY",
  logo: "/design/roofmri-mark.svg",
  wordmark: "/design/roofmri-wordmark.svg",
  qr: "/design/roofmri-contact.svg",
  qrAlt: "Roof MRI — roof-mri.com",
  phone: "roof-mri.com",
  repName: "Roof MRI",
  accent: "#1E2C55",
  accentSoft: "#EEF1F7",
  accentRgb: "15,26,58",
  credentials: [
    { k: "Technology", v: "U.S. patent allowed" },
    { k: "Measurement", v: "Square-by-square" },
    { k: "Standard", v: "ASTM-aligned" },
    { k: "Record", v: "Audit-grade & repeatable" },
  ],
};

export const BRANDS: Record<string, Brand> = { allstar, roofmri };

/** Valid values for a report's `brand` field. */
export const BRAND_KEYS = Object.keys(BRANDS);

/**
 * Deployment default for brandless reports. Stays `allstar` so every existing
 * Allstar report and the Allstar builder (which never sends `brand`) render
 * exactly as before. Override with DEFAULT_REPORT_BRAND on a Roof-MRI-first
 * deployment. Read at call time so it is never baked into the client bundle.
 */
function defaultBrandKey(): string {
  const env =
    typeof process !== "undefined" && process.env?.DEFAULT_REPORT_BRAND
      ? String(process.env.DEFAULT_REPORT_BRAND).toLowerCase().trim()
      : "";
  return BRANDS[env] ? env : "allstar";
}

/** Resolve a report's brand, tolerating undefined / unknown keys. */
export function getBrand(key?: string | null): Brand {
  const k = typeof key === "string" ? key.toLowerCase().trim() : "";
  return BRANDS[k] ?? BRANDS[defaultBrandKey()] ?? allstar;
}
