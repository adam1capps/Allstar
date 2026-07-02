import { customAlphabet } from "nanoid";

/**
 * MC Scan report data model + computed template values.
 *
 * This is a TypeScript port of the `renderVals()` logic embedded in the Claude
 * Design file `MC Scan Report Generator.html` — the design's own component
 * source is the spec. The computed object feeds the design's mustache/sc-for
 * templates (see lib/design/) both server-side (permanent report links) and
 * client-side (live builder preview), so the numbers always match the design.
 *
 * A "square" is a 10×10 ft scan cell = 100 SF.
 */

export interface McScanData {
  // Building & job
  buildingName: string;
  address: string;
  scanDate: string;
  inspector: string;
  preparedFor: string;
  // Roof facts
  roofType: string;
  insulation: string;
  sections: string;
  method: string;
  // Moisture scan results (squares)
  wetSq: number;
  dampSq: number;
  drySq: number;
  undSq: number;
  // Photos (data URLs; empty string = not provided)
  coverPhoto: string;
  overlayImg: string;
  photo1: string;
  photo2: string;
  photo3: string;
  photo4: string;
  // Findings & diagnosis
  analysis: string;
  diagHeadline: string;
  diagText: string;
  recommended: string;
}

export interface StoredReport extends McScanData {
  id: string;
  createdAt: string;
}

export const OPTION_TITLES = [
  "Spot Dry-Out",
  "Targeted Repair",
  "Roof Coating",
  "Partial Re-Roof",
  "Full Re-Roof",
] as const;

/** Sample job shipped with the design (photos omitted). */
export const SAMPLE: McScanData = {
  buildingName: "PetSmart — Bozeman",
  address: "2997 Max Ave · Bozeman, MT 59718",
  scanDate: "June 5, 2026",
  inspector: "Dane Hannusch",
  preparedFor: "PetSmart, Inc.",
  roofType: "TPO",
  insulation: 'Poly ISO 4"',
  sections: "1",
  method: "Pin-prick + Impedance",
  wetSq: 7,
  dampSq: 9,
  drySq: 191,
  undSq: 0,
  coverPhoto: "/design/sample/cover.jpg",
  overlayImg: "/design/sample/overlay.jpg",
  photo1: "/design/sample/photo1.jpg",
  photo2: "/design/sample/photo2.jpg",
  photo3: "/design/sample/photo3.jpg",
  photo4: "/design/sample/photo4.jpg",
  analysis:
    "A scan of this 20,700 SF TPO roof section identifies moisture within the insulation layer, with 3% classified as wet and 4% as damp — a combined 7% moisture presence. The remaining 92% returned dry readings, indicating the vast majority of the system is currently in stable condition. A targeted dry-out is recommended to remediate the identified zones and preserve the integrity of the roofing system.",
  diagHeadline: "Targeted dry-out recommended — the roof does not need replacement.",
  diagText:
    "Moisture affects about 7% of the roof — 7 wet and 9 damp squares (1,600 SF) — while 92% reads dry. A targeted dry-out remediates the identified zones and preserves the remaining service life of the TPO system.",
  recommended: "Spot Dry-Out",
};

/** Neutral placeholder shown in the report when a photo slot is empty. */
const PHOTO_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500">' +
      '<rect width="100%" height="100%" fill="#EDEFF1"/>' +
      '<text x="50%" y="50%" font-family="Arial,sans-serif" font-size="22" fill="#A9A9AF" text-anchor="middle" dominant-baseline="middle">Photo not provided</text>' +
      "</svg>",
  );

/** URL-safe, unguessable id — this is what makes report links safe to share. */
const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuv", 12);
export function generateReportId(): string {
  return nanoid();
}

// ---------------------------------------------------------------------------
// Computed template values (port of the design's renderVals())
// ---------------------------------------------------------------------------

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** ✓ / ◐ / — glyph cells for the MRI vs. infrared vs. impedance table. */
const glyph = (v: "y" | "p" | "n", red: boolean) => ({
  m: v === "y" ? "✓" : v === "p" ? "◐" : "—",
  c: red ? "#C8302F" : v === "y" ? "#6E7178" : "#BDBDC2",
});

const COMP_ROWS = [
  { c: "Detects moisture in the roof & insulation", mri: "y", ir: "p", imp: "p" },
  { c: "Quantifies severity, square by square", mri: "y", ir: "n", imp: "p" },
  { c: "Maps the entire roof field", mri: "y", ir: "p", imp: "n" },
  { c: "Unaffected by surface temperature & weather", mri: "y", ir: "n", imp: "p" },
  { c: "Repeatable, audit-grade record", mri: "y", ir: "p", imp: "n" },
] as const;

// Fully constant — derived once, not per computeVals call.
const COMP_ROWS_RENDERED = COMP_ROWS.map((r) => ({
  c: r.c,
  mri: glyph(r.mri, true),
  ir: glyph(r.ir, false),
  imp: glyph(r.imp, false),
}));

const SCALE_BANDS = [
  { name: "Dry", range: "0 – 10", desc: "Baseline. No elevated moisture detected.", sw: "#EDEFF2", fg: "#4D4D4D", bar: "#EDEFF2" },
  { name: "Dry to Touch", range: "10 – 35", desc: "Surface-dry with only trace sub-surface moisture. Monitor.", sw: "#F3C9C7", fg: "#7A2A28", bar: "#F3C9C7" },
  { name: "Damp", range: "35 – 65", desc: "Active moisture within the insulation. Dry-out viable.", sw: "#DD7A77", fg: "#ffffff", bar: "#DD7A77" },
  { name: "Wet", range: "65+", desc: "Saturated core. Section replacement likely.", sw: "#A52529", fg: "#ffffff", bar: "#A52529" },
];

const OPTION_DEFS: Array<[string, string, string]> = [
  ["Spot Dry-Out", "Insulation is wet but the membrane is intact.", "Rapid-Vent units dry the insulation in place over a measured cycle — no tear-off required."],
  ["Targeted Repair", "Moisture is isolated to a small area.", "Open, dry and replace wet insulation in affected squares; reseal penetrations and flashings."],
  ["Roof Coating", "Field is dry and the membrane is aging.", "A restorative reflective coating extends service life and seals minor surface wear."],
  ["Partial Re-Roof", "Saturation is contained to defined sections.", "Tear out and rebuild only the failed sections; preserve the sound, dry field."],
  ["Full Re-Roof", "Moisture and failure are widespread.", "Complete system replacement with a new, fully warrantied roof assembly."],
];

const STEPS = [
  { n: "1", t: "Initial consultation", d: "We review the building, its history and your goals." },
  { n: "2", t: "MRI moisture scan", d: "A full-roof diagnostic scan — and this report." },
  { n: "3", t: "Identify damage & moisture", d: "Pinpoint every wet square and its severity." },
  { n: "4", t: "Solutions & estimate", d: "Repair, coating, partial or full re-roof — priced." },
  { n: "5", t: "In-person review", d: "We walk the options and the numbers with you." },
  { n: "6", t: "Decision point", d: "You choose the path that fits the building and budget." },
  { n: "7", t: "Contract & schedule", d: "Scope, timeline and crews are locked in." },
  { n: "8", t: "Licensing & permitting", d: "We handle all permits and code requirements." },
];

const CREDENTIALS = [
  { k: "Serving since", v: "1979" },
  { k: "In business", v: "45+ years" },
  { k: "Certification", v: "CertainTeed Premier ShingleMaster" },
  { k: "Status", v: "Licensed · Bonded · Insured" },
];

export type TemplateValues = Record<string, unknown>;

export interface ComputeOptions {
  /** Substitute a neutral placeholder image for empty photo slots (viewer). */
  photoFallback?: boolean;
}

export function computeVals(data: Partial<McScanData>, opts: ComputeOptions = {}): TemplateValues {
  const d: McScanData = { ...SAMPLE, ...data };

  const wetSq = +d.wetSq || 0;
  const dampSq = +d.dampSq || 0;
  const drySq = +d.drySq || 0;
  const undSq = +d.undSq || 0;
  const totSq = wetSq + dampSq + drySq + undSq;
  const divTot = totSq || 1; // avoid div-by-zero; displayed totals use totSq
  const pc = (n: number) => Math.round((n / divTot) * 100);
  const totalSF = totSq * 100;
  const areaStr = `${fmt(totalSF)} SF`;

  const rows = [
    { cls: "Wet", sq: fmt(wetSq), sf: fmt(wetSq * 100), pct: `${pc(wetSq)}%`, cond: "Moisture confirmed within the insulation layer", c: "#F01F1F" },
    { cls: "Damp", sq: fmt(dampSq), sf: fmt(dampSq * 100), pct: `${pc(dampSq)}%`, cond: "Elevated readings — moisture developing", c: "#FFD84D" },
    { cls: "Dry", sq: fmt(drySq), sf: fmt(drySq * 100), pct: `${pc(drySq)}%`, cond: "Stable — no action required", c: "#00BD70" },
    { cls: "Undetermined", sq: fmt(undSq), sf: fmt(undSq * 100), pct: `${pc(undSq)}%`, cond: "—", c: "#D7D8DC" },
  ];
  const rowsTotal = {
    sq: fmt(totSq),
    sf: fmt(totalSF),
    pct: "100%",
    note: `${pc(wetSq) + pc(dampSq)}% combined moisture`,
  };

  const recommended = OPTION_TITLES.includes(d.recommended as (typeof OPTION_TITLES)[number])
    ? d.recommended
    : "Spot Dry-Out";
  const options = OPTION_DEFS.map(([title, when, scope]) => ({
    title,
    when,
    scope,
    rec: title === recommended,
  }));

  const breakdown = [
    { k: "Wet", pct: `${pc(wetSq)}%`, sf: `${fmt(wetSq * 100)} SF`, sq: `${fmt(wetSq)} sq`, c: "#F01F1F" },
    { k: "Damp", pct: `${pc(dampSq)}%`, sf: `${fmt(dampSq * 100)} SF`, sq: `${fmt(dampSq)} sq`, c: "#FFD84D" },
    { k: "Dry", pct: `${pc(drySq)}%`, sf: `${fmt(drySq * 100)} SF`, sq: `${fmt(drySq)} sq`, c: "#00BD70" },
    { k: "Undetermined", pct: `${pc(undSq)}%`, sf: `${fmt(undSq * 100)} SF`, sq: `${fmt(undSq)} sq`, c: "#D7D8DC" },
  ];

  // computeVals also runs on unvalidated builder-side data (?job= import,
  // loaded job files, localStorage), so photo values are re-checked here —
  // this is the single choke point before they reach <img src> or CSS url().
  const safeSrc = (src: string) =>
    typeof src === "string" && (DATA_IMAGE_RE.test(src) || SAMPLE_PHOTO_PATHS.has(src))
      ? src
      : "";
  const photo = (src: string) =>
    safeSrc(src) || (opts.photoFallback ? PHOTO_PLACEHOLDER : "");
  const zoneBg = (src: string, empty: string, fit: "cover" | "contain") => {
    const safe = safeSrc(src);
    return safe ? `#eee url('${safe}') center/${fit} no-repeat` : empty;
  };

  return {
    // fixed content
    compRows: COMP_ROWS_RENDERED,
    scaleBands: SCALE_BANDS,
    options,
    steps: STEPS,
    credentials: CREDENTIALS,
    swap: "none",
    sheetBg: "linear-gradient(160deg,#ECECEE,#E3E3E6)",
    // job values
    buildingName: d.buildingName,
    address: d.address,
    scanDate: d.scanDate,
    inspector: d.inspector,
    preparedFor: d.preparedFor,
    roofType: d.roofType,
    roofArea: areaStr,
    insulation: d.insulation,
    sections: String(d.sections),
    method: d.method,
    analysis: d.analysis,
    diagHeadline: d.diagHeadline,
    diagText: d.diagText,
    // photos
    coverPhoto: photo(d.coverPhoto),
    overlayImg: photo(d.overlayImg),
    photo1: photo(d.photo1),
    photo2: photo(d.photo2),
    photo3: photo(d.photo3),
    photo4: photo(d.photo4),
    hasCover: !!d.coverPhoto,
    hasOverlay: !!d.overlayImg,
    hasP1: !!d.photo1,
    hasP2: !!d.photo2,
    hasP3: !!d.photo3,
    hasP4: !!d.photo4,
    coverBg: zoneBg(d.coverPhoto, "#EEF0F2", "cover"),
    overlayBg: zoneBg(d.overlayImg, "#EDEFF1", "contain"),
    p1Bg: zoneBg(d.photo1, "#F2F2F4", "cover"),
    p2Bg: zoneBg(d.photo2, "#F2F2F4", "cover"),
    p3Bg: zoneBg(d.photo3, "#F2F2F4", "cover"),
    p4Bg: zoneBg(d.photo4, "#F2F2F4", "cover"),
    // scan tables
    rows,
    rowsTotal,
    breakdown,
    totals: { sq: fmt(totSq), sf: areaStr },
    wetPct: `${pc(wetSq)}%`,
    dampPct: `${pc(dampSq)}%`,
    dryPct: `${pc(drySq)}%`,
    undPct: `${pc(undSq)}%`,
    calcTotSq: fmt(totSq),
    calcTotSF: areaStr,
    combinedPct: `${pc(wetSq) + pc(dampSq)}%`,
    // form echoes
    f_buildingName: d.buildingName,
    f_address: d.address,
    f_scanDate: d.scanDate,
    f_inspector: d.inspector,
    f_preparedFor: d.preparedFor,
    f_roofType: d.roofType,
    f_insulation: d.insulation,
    f_sections: String(d.sections),
    f_method: d.method,
    f_wetSq: String(wetSq),
    f_dampSq: String(dampSq),
    f_drySq: String(drySq),
    f_undSq: String(undSq),
    f_analysis: d.analysis,
    f_diagHeadline: d.diagHeadline,
    f_diagText: d.diagText,
    f_recommended: recommended,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** data:image/... URL (what the builder produces) — nothing else may reach an
 *  <img src> or CSS url() in the rendered report, except the bundled sample
 *  photo paths below. */
const DATA_IMAGE_RE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const SAMPLE_PHOTO_PATHS = new Set([
  SAMPLE.coverPhoto,
  SAMPLE.overlayImg,
  SAMPLE.photo1,
  SAMPLE.photo2,
  SAMPLE.photo3,
  SAMPLE.photo4,
]);

const TEXT_LIMITS: Record<string, number> = {
  buildingName: 200,
  address: 300,
  scanDate: 100,
  inspector: 150,
  preparedFor: 200,
  roofType: 150,
  insulation: 150,
  sections: 50,
  method: 150,
  analysis: 6000,
  diagHeadline: 400,
  diagText: 6000,
  recommended: 50,
};

const PHOTO_FIELDS = ["coverPhoto", "overlayImg", "photo1", "photo2", "photo3", "photo4"] as const;
const NUM_FIELDS = ["wetSq", "dampSq", "drySq", "undSq"] as const;

export function validateMcScanData(input: unknown): {
  ok: boolean;
  errors: string[];
  value?: McScanData;
} {
  const errors: string[] = [];
  const src = (input ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  // Text fields are required and non-empty — a missing field is an error, not
  // an invitation to substitute sample content (a report must never silently
  // carry another job's data). The builder always sends complete objects.
  for (const [key, max] of Object.entries(TEXT_LIMITS)) {
    const v = src[key];
    if (typeof v !== "string" || v.trim() === "") {
      errors.push(`${key} is required.`);
      continue;
    }
    if (v.length > max) {
      errors.push(`${key} is too long (max ${max} characters).`);
      continue;
    }
    out[key] = v.trim();
  }

  for (const key of NUM_FIELDS) {
    const raw = src[key];
    // "" means a cleared form input — the live preview shows it as 0, so store 0
    const n = raw === "" ? 0 : typeof raw === "string" ? Number(raw) : raw;
    if (raw == null) {
      errors.push(`${key} is required.`);
      continue;
    }
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1_000_000) {
      errors.push(`${key} must be a number between 0 and 1,000,000.`);
      continue;
    }
    out[key] = n;
  }

  for (const key of PHOTO_FIELDS) {
    const v = src[key];
    if (v == null || v === "") {
      out[key] = "";
      continue;
    }
    if (typeof v !== "string" || !(DATA_IMAGE_RE.test(v) || SAMPLE_PHOTO_PATHS.has(v))) {
      errors.push(`${key} must be an uploaded image.`);
      continue;
    }
    out[key] = v;
  }

  if (
    typeof out.recommended === "string" &&
    !OPTION_TITLES.includes(out.recommended as never)
  ) {
    errors.push(`recommended must be one of: ${OPTION_TITLES.join(", ")}.`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: out as unknown as McScanData };
}
