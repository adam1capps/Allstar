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

export interface ScanSection {
  name: string;
  wetSq: number;
  dampSq: number;
  drySq: number;
  undSq: number;
}

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
  // Moisture scan results (squares). When the roof has multiple sections,
  // scanSections carries the per-section counts and the flat fields hold the
  // property-wide sums (kept for older reports and API consumers).
  wetSq: number;
  dampSq: number;
  drySq: number;
  undSq: number;
  scanSections?: ScanSection[];
  // Photos (data URLs; empty string = not provided)
  coverPhoto: string;
  overlayImg: string;
  photo1: string;
  photo2: string;
  photo3: string;
  photo4: string;
  // Evidence photo captions; empty string = the design's default caption
  photoCaption1?: string;
  photoCaption2?: string;
  photoCaption3?: string;
  photoCaption4?: string;
  // Findings & diagnosis
  analysis: string;
  diagHeadline: string;
  diagText: string;
  recommended: string;
}

export interface StoredReport extends McScanData {
  id: string;
  createdAt: string;
  /** Set whenever Regina edits the report after creation. */
  updatedAt?: string;
  /** Regina checked "client fills in the findings" when creating the link. */
  clientFillsFindings?: boolean;
  /** Set when the client saves their findings — the report is locked from then on. */
  findingsSubmittedAt?: string;
}

/** The "Findings & diagnosis" section — what a client completes when Regina
 *  delegates the findings. Everything else is locked at creation. */
export const FINDINGS_FIELDS = [
  "analysis",
  "diagHeadline",
  "diagText",
  "recommended",
] as const;
export type FindingsFields = Pick<McScanData, (typeof FINDINGS_FIELDS)[number]>;

/** Optional extras a client may include with their findings: replacement
 *  evidence photos for the four-grid and their captions. */
export const FINDINGS_PHOTO_FIELDS = ["photo1", "photo2", "photo3", "photo4"] as const;
export const FINDINGS_CAPTION_FIELDS = [
  "photoCaption1",
  "photoCaption2",
  "photoCaption3",
  "photoCaption4",
] as const;
export type FindingsSubmission = FindingsFields &
  Partial<Pick<McScanData, (typeof FINDINGS_PHOTO_FIELDS)[number] | (typeof FINDINGS_CAPTION_FIELDS)[number]>>;

/** The design's own evidence captions (photo 4's is roof-type-driven). */
export function defaultCaptions(roofType: string): [string, string, string, string] {
  return [
    "Recon kit — Tramex MEX5, RWS scanner & probes",
    "On-roof reading beside a rooftop penetration",
    "Calibrated instruments — MEX5 & RWS scanner",
    `${roofType} roof field`,
  ];
}

export function isAwaitingFindings(report: StoredReport): boolean {
  return !!report.clientFillsFindings && !report.findingsSubmittedAt;
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
  { k: "Certification", v: "Elevate / Firestone & Gaco Coatings" },
  { k: "Status", v: "Licensed · Bonded · Insured" },
];

export type TemplateValues = Record<string, unknown>;

export interface ComputeOptions {
  /** Substitute a neutral placeholder image for empty photo slots (viewer). */
  photoFallback?: boolean;
}

export function computeVals(data: Partial<McScanData>, opts: ComputeOptions = {}): TemplateValues {
  const d: McScanData = { ...SAMPLE, ...data };

  // Per-section counts when present; otherwise the flat fields are one section.
  const scanSections: ScanSection[] =
    Array.isArray(d.scanSections) && d.scanSections.length > 0
      ? d.scanSections
      : [
          {
            name: "Roof",
            wetSq: +d.wetSq || 0,
            dampSq: +d.dampSq || 0,
            drySq: +d.drySq || 0,
            undSq: +d.undSq || 0,
          },
        ];

  // The property-wide overall — every existing stat in the report reads these.
  const wetSq = scanSections.reduce((n, s) => n + (+s.wetSq || 0), 0);
  const dampSq = scanSections.reduce((n, s) => n + (+s.dampSq || 0), 0);
  const drySq = scanSections.reduce((n, s) => n + (+s.drySq || 0), 0);
  const undSq = scanSections.reduce((n, s) => n + (+s.undSq || 0), 0);
  const totSq = wetSq + dampSq + drySq + undSq;
  const divTot = totSq || 1; // avoid div-by-zero; displayed totals use totSq
  const pc = (n: number) => Math.round((n / divTot) * 100);
  const totalSF = totSq * 100;
  const areaStr = `${fmt(totalSF)} SF`;

  // Section-by-section table (sheet 07) — shown when there is more than one.
  const sectionRows = scanSections.map((s, i) => {
    const w = +s.wetSq || 0;
    const dm = +s.dampSq || 0;
    const dr = +s.drySq || 0;
    const u = +s.undSq || 0;
    const tot = w + dm + dr + u;
    return {
      name: s.name?.trim() || `Section ${i + 1}`,
      sf: fmt(tot * 100),
      wet: fmt(w * 100),
      damp: fmt(dm * 100),
      dry: fmt(dr * 100),
      und: fmt(u * 100),
      pct: `${Math.round(((w + dm) / (tot || 1)) * 100)}%`,
    };
  });
  const sectionsTotal = {
    sf: fmt(totalSF),
    wet: fmt(wetSq * 100),
    damp: fmt(dampSq * 100),
    dry: fmt(drySq * 100),
    und: fmt(undSq * 100),
    pct: `${pc(wetSq) + pc(dampSq)}%`,
  };
  const hasMultipleSections = scanSections.length > 1;

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
    sections:
      Array.isArray(d.scanSections) && d.scanSections.length > 0
        ? String(d.scanSections.length)
        : String(d.sections),
    method: d.method,
    // section-by-section results
    sectionRows,
    sectionsTotal,
    hasMultipleSections,
    singleSection: !hasMultipleSections,
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
    photoCap1: d.photoCaption1?.trim() || defaultCaptions(d.roofType)[0],
    photoCap2: d.photoCaption2?.trim() || defaultCaptions(d.roofType)[1],
    photoCap3: d.photoCaption3?.trim() || defaultCaptions(d.roofType)[2],
    photoCap4: d.photoCaption4?.trim() || defaultCaptions(d.roofType)[3],
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
    f_sections:
      Array.isArray(d.scanSections) && d.scanSections.length > 0
        ? String(d.scanSections.length)
        : String(d.sections),
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

export interface ValidateOptions {
  /** The findings section may be blank — the client will complete it via the
   *  report link (Regina checked "client fills in the findings"). */
  findingsOptional?: boolean;
}

export function validateMcScanData(
  input: unknown,
  opts: ValidateOptions = {},
): {
  ok: boolean;
  errors: string[];
  value?: McScanData;
} {
  const errors: string[] = [];
  const src = (input ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const optionalKeys: ReadonlySet<string> = opts.findingsOptional
    ? new Set(FINDINGS_FIELDS)
    : new Set();

  // Text fields are required and non-empty — a missing field is an error, not
  // an invitation to substitute sample content (a report must never silently
  // carry another job's data). The builder always sends complete objects.
  for (const [key, max] of Object.entries(TEXT_LIMITS)) {
    const v = src[key];
    if (typeof v !== "string" || v.trim() === "") {
      if (optionalKeys.has(key)) {
        out[key] = "";
        continue;
      }
      errors.push(`${key} is required.`);
      continue;
    }
    if (v.length > max) {
      errors.push(`${key} is too long (max ${max} characters).`);
      continue;
    }
    out[key] = v.trim();
  }

  // Per-section scan results. When present they are authoritative — the flat
  // fields are overwritten with the property-wide sums.
  const rawSections = src.scanSections;
  if (rawSections != null) {
    if (!Array.isArray(rawSections) || rawSections.length === 0 || rawSections.length > 60) {
      errors.push("scanSections must be a list of 1–60 sections.");
    } else {
      const sections: ScanSection[] = [];
      rawSections.forEach((raw, i) => {
        const s = (raw ?? {}) as Record<string, unknown>;
        const name =
          typeof s.name === "string" && s.name.trim() !== ""
            ? s.name.trim().slice(0, 120)
            : `Section ${i + 1}`;
        const nums: Record<string, number> = {};
        for (const key of NUM_FIELDS) {
          const rawN = s[key];
          const n = rawN === "" || rawN == null ? 0 : typeof rawN === "string" ? Number(rawN) : rawN;
          if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1_000_000) {
            errors.push(`scanSections[${i}].${key} must be a number between 0 and 1,000,000.`);
            return;
          }
          nums[key] = n;
        }
        sections.push({ name, wetSq: nums.wetSq, dampSq: nums.dampSq, drySq: nums.drySq, undSq: nums.undSq });
      });
      if (sections.length === rawSections.length) {
        out.scanSections = sections;
        for (const key of NUM_FIELDS) {
          out[key] = sections.reduce((n, s) => n + s[key], 0);
        }
      }
    }
  }

  if (out.scanSections == null) {
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

  for (const key of FINDINGS_CAPTION_FIELDS) {
    const v = src[key];
    if (v == null || v === "") continue; // empty = design default caption
    if (typeof v !== "string" || v.length > 200) {
      errors.push(`${key} must be text up to 200 characters.`);
      continue;
    }
    out[key] = v.trim();
  }

  if (
    typeof out.recommended === "string" &&
    out.recommended !== "" && // "" only occurs when findings are client-completed
    !OPTION_TITLES.includes(out.recommended as never)
  ) {
    errors.push(`recommended must be one of: ${OPTION_TITLES.join(", ")}.`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: out as unknown as McScanData };
}

/** Validates the client's findings submission: the delegated text fields plus
 *  optional replacement evidence photos and captions. */
export function validateFindings(input: unknown): {
  ok: boolean;
  errors: string[];
  value?: FindingsSubmission;
} {
  const errors: string[] = [];
  const src = (input ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};

  for (const key of FINDINGS_FIELDS) {
    const v = src[key];
    const max = TEXT_LIMITS[key];
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

  if (out.recommended && !OPTION_TITLES.includes(out.recommended as never)) {
    errors.push(`recommended must be one of: ${OPTION_TITLES.join(", ")}.`);
  }

  // Optional replacement photos — absent/empty means "keep what the report has".
  for (const key of FINDINGS_PHOTO_FIELDS) {
    const v = src[key];
    if (v == null || v === "") continue;
    if (typeof v !== "string" || !(DATA_IMAGE_RE.test(v) || SAMPLE_PHOTO_PATHS.has(v))) {
      errors.push(`${key} must be an uploaded image.`);
      continue;
    }
    out[key] = v;
  }

  for (const key of FINDINGS_CAPTION_FIELDS) {
    const v = src[key];
    if (v == null || v === "") continue;
    if (typeof v !== "string" || v.length > 200) {
      errors.push(`${key} must be text up to 200 characters.`);
      continue;
    }
    out[key] = v.trim();
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: out as unknown as FindingsSubmission };
}
