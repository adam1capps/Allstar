/**
 * Compiles the extracted Claude Design templates (lib/design/*.html|css) into
 * lib/design/embedded.ts so the Next.js server bundle carries them without any
 * filesystem access at runtime (required for Netlify serverless functions).
 *
 * Also applies one-time structural transforms to the builder template:
 *  - toolbar action buttons get `data-action` hooks (the design bound them via
 *    `onclick="{{...}}"` placeholders, which we strip)
 *  - a "Create shareable link" button is injected as the primary action
 *  - `<sc-if>` blocks become always-rendered content tagged with `data-if` so
 *    the client can toggle visibility without re-rendering the form
 *  - remaining `on*="{{...}}"` handler placeholders are stripped (the client
 *    uses event delegation on `data-key` / `data-action` attributes instead)
 *
 * The report template is embedded as-is; it contains no event handlers.
 *
 * Run via `npm run embed-design` (wired into predev/prebuild).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(root, "lib/design", f), "utf8");

const fontsCss = read("fonts.css");
const baseCss = read("base.css");
const printFixCss = read("print-fix.css");
const reportTpl = read("report.html");
let builderTpl = read("builder.html");

// --- builder transforms -----------------------------------------------------

// 1. Toolbar buttons / inputs -> data-action hooks.
const actionMap = [
  ['onclick="{{doPrint}}"', 'data-action="print"'],
  ['onclick="{{downloadReport}}"', 'data-action="downloadReport"'],
  ['onclick="{{downloadJob}}"', 'data-action="downloadJob"'],
  ['onclick="{{resetAll}}"', 'data-action="resetAll"'],
  ['onchange="{{onLoadJob}}"', 'data-action="loadJob"'],
];
for (const [from, to] of actionMap) {
  if (!builderTpl.includes(from)) {
    throw new Error(`embed-design: expected builder marker not found: ${from}`);
  }
  builderTpl = builderTpl.replace(from, to);
}

// 2. Inject the "Create shareable link" button as the primary toolbar action,
//    styled to match the design's toolbar buttons.
const printBtnIdx = builderTpl.indexOf('<button data-action="print"');
if (printBtnIdx < 0) throw new Error("embed-design: print button not found");
const createLinkBtn =
  `<button data-action="createLink" style="display:inline-flex;align-items:center;gap:7px;` +
  `background:#00BD70;color:#fff;border:none;font:700 12.5px 'Open Sans',sans-serif;` +
  `padding:10px 15px;border-radius:9px;cursor:pointer;">Create shareable link</button> `;
builderTpl =
  builderTpl.slice(0, printBtnIdx) + createLinkBtn + builderTpl.slice(printBtnIdx);

// 2b. A "Reports" link (report index + PDFs) at the end of the toolbar,
//     styled like the outline toolbar buttons.
{
  const loadJobEnd = builderTpl.indexOf(
    "</label>",
    builderTpl.indexOf('data-action="loadJob"'),
  );
  if (loadJobEnd < 0) throw new Error("embed-design: load-job label not found");
  const reportsLink =
    ` <a href="/builder/reports" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.32);` +
    `font:600 12px 'Open Sans',sans-serif;padding:9px 13px;border-radius:9px;cursor:pointer;text-decoration:none;">Reports</a>`;
  builderTpl =
    builderTpl.slice(0, loadJobEnd + "</label>".length) +
    reportsLink +
    builderTpl.slice(loadJobEnd + "</label>".length);
}

// 3. <sc-if value="{{key}}" ...>CONTENT</sc-if> -> CONTENT with data-if="key"
//    on its first element (client toggles `display` from state).
builderTpl = builderTpl.replace(
  /<sc-if value="\{\{(\w+)\}\}"[^>]*>([\s\S]*?)<\/sc-if>/g,
  (_, key, content) => content.replace(/<(\w+)/, `<$1 data-if="${key}"`),
);

// 4. Strip the handler placeholders the client runtime replaces with event
//    delegation. Anything OUTSIDE this allowlist means the design gained new
//    behavior that nobody wired up — fail the build instead of shipping a
//    dead control.
const KNOWN_STRIPPED_HANDLERS = new Set([
  "onField",
  "onImgInput",
  "onImgDrop",
  "onImgClear",
  "prevent",
]);
const unknownHandlers = [];
builderTpl = builderTpl.replace(
  /\son[a-z]+="\{\{\s*([^}]+?)\s*\}\}"/g,
  (m, name) => {
    if (!KNOWN_STRIPPED_HANDLERS.has(name)) unknownHandlers.push(name);
    return "";
  },
);
if (unknownHandlers.length > 0) {
  throw new Error(
    `embed-design: unwired template handlers (add delegation in BuilderClient or map to data-action): ${unknownHandlers.join(", ")}`,
  );
}

// 5. Structural invariants the client runtime depends on — fail loudly at
//    build time if a re-extracted design changed shape.
const PHOTO_KEYS = ["coverPhoto", "overlayImg", "photo1", "photo2", "photo3", "photo4"];
for (const key of PHOTO_KEYS) {
  if (!builderTpl.includes(`<label data-key="${key}"`)) {
    throw new Error(`embed-design: photo drop zone <label data-key="${key}"> missing`);
  }
}
if (!builderTpl.includes('<select data-key="recommended"')) {
  throw new Error('embed-design: <select data-key="recommended"> missing');
}

// --- report transforms --------------------------------------------------------

// The design bakes its sample job ("PetSmart — 2997 Max Ave, Bozeman") into a
// few visible strings and alt texts. Every report must not carry another
// client's address, so those become generic or template-driven.
const sampleTextMap = [
  ['alt="PetSmart — 2997 Max Ave, Bozeman MT"', 'alt="Building cover photo"'],
  ['alt="Moisture overlay map — 2997 Max Ave"', 'alt="Moisture overlay map"'],
  [">Moisture Overlay Map · 2997 Max Ave<", ">Moisture Overlay Map<"],
  ['alt="TPO roof field at 2997 Max Ave"', 'alt="Roof field"'],
  [">TPO roof field — 2997 Max Ave, Bozeman<", ">{{roofType}} roof field<"],
];
let fittedReportTpl = reportTpl;
for (const [from, to] of sampleTextMap) {
  if (!fittedReportTpl.includes(from)) {
    throw new Error(`embed-design: expected report sample text not found: ${from}`);
  }
  fittedReportTpl = fittedReportTpl.replace(from, to);
}

// Evidence-photo captions become data-driven (clients can replace the photos,
// so the labels must be editable; defaults are the design's own captions).
const captionMap = [
  [">Recon kit — Tramex MEX5, RWS scanner &amp; probes<", ">{{photoCap1}}<"],
  [">On-roof reading beside a rooftop penetration<", ">{{photoCap2}}<"],
  [">Calibrated instruments — MEX5 &amp; RWS scanner<", ">{{photoCap3}}<"],
  [">{{roofType}} roof field<", ">{{photoCap4}}<"],
];
for (const [from, to] of captionMap) {
  if (!fittedReportTpl.includes(from)) {
    throw new Error(`embed-design: expected caption not found: ${from}`);
  }
  fittedReportTpl = fittedReportTpl.replace(from, to);
}

// Mark free-text elements so the fit runtime can shrink them when a job's text
// is longer than the fixed Letter sheet allows (prevents content spilling into
// the footer / off the printed page).
for (const key of ["analysis", "diagHeadline", "diagText"]) {
  const re = new RegExp(`(<[a-z][^>]*)(>\\s*\\{\\{${key}\\}\\})`);
  if (!re.test(fittedReportTpl)) {
    throw new Error(`embed-design: fit target {{${key}}} not found in report template`);
  }
  fittedReportTpl = fittedReportTpl.replace(re, `$1 data-fit$2`);
}

// --- multi-section support ----------------------------------------------------

// Report, sheet 07: the classification table stays for single-section jobs;
// multi-section jobs get a section-by-section table with an entire-property
// total row in the same visual language.
{
  const tableStart = fittedReportTpl.indexOf("<!-- zone table -->");
  const photosStart = fittedReportTpl.indexOf("<!-- photo evidence zone -->");
  if (tableStart < 0 || photosStart < 0 || photosStart < tableStart) {
    throw new Error("embed-design: sheet-07 zone table anchors not found");
  }
  const originalTable = fittedReportTpl.slice(tableStart, photosStart);

  const th = (label, opts = {}) =>
    `<div style="padding:0 ${opts.edge ? "16px" : "8px"};${opts.left ? "" : "text-align:right;"}` +
    `font:700 8.5px 'Open Sans',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#C8302F;">${label}</div>`;
  const td = (expr, opts = {}) =>
    `<div style="padding:0 ${opts.edge ? "16px" : "8px"};${opts.left ? "" : "text-align:right;"}` +
    `font-size:12px;${opts.strong ? "font-weight:700;color:#111;font-size:12.5px;" : "color:#333;"}` +
    `${opts.red ? "font-weight:700;color:#C8302F;" : ""}">${expr}</div>`;
  const tt = (expr, opts = {}) =>
    `<div style="padding:0 ${opts.edge ? "16px" : "8px"};${opts.left ? "" : "text-align:right;"}` +
    `font-weight:800;font-size:12px;color:${opts.red ? "#C8302F" : "#111"};` +
    `${opts.title ? "font-family:'Exo',sans-serif;font-size:13px;" : ""}">${expr}</div>`;
  const grid = "display:grid;grid-template-columns:1.7fr .9fr .75fr .78fr .75fr .82fr 1fr;";

  const sectionTable =
    `<div style="background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(17,17,17,.05),0 10px 26px rgba(17,17,17,.05);overflow:hidden;">` +
    `<div style="${grid}background:#FBEDEC;padding:11px 0;">` +
    th("Section", { edge: true, left: true }) +
    th("Area (SF)") +
    th("Wet (SF)") +
    th("Damp (SF)") +
    th("Dry (SF)") +
    th("Undet. (SF)") +
    th("Moisture", { edge: true }) +
    `</div>` +
    `<sc-for list="{{sectionRows}}" as="s" hint-placeholder-count="3">` +
    `<div style="${grid}align-items:center;border-top:1px solid #EFEFF1;padding:12px 0;">` +
    td("{{s.name}}", { edge: true, left: true, strong: true }) +
    td("{{s.sf}}") +
    td("{{s.wet}}") +
    td("{{s.damp}}") +
    td("{{s.dry}}") +
    td("{{s.und}}") +
    td("{{s.pct}}", { edge: true, red: true }) +
    `</div>` +
    `</sc-for>` +
    `<div style="${grid}align-items:center;border-top:2px solid #111;padding:13px 0;background:#FAFAFB;">` +
    tt("Entire property", { edge: true, left: true, title: true }) +
    tt("{{sectionsTotal.sf}}") +
    tt("{{sectionsTotal.wet}}") +
    tt("{{sectionsTotal.damp}}") +
    tt("{{sectionsTotal.dry}}") +
    tt("{{sectionsTotal.und}}") +
    tt("{{sectionsTotal.pct}}", { edge: true, red: true }) +
    `</div>` +
    `</div> `;

  fittedReportTpl =
    fittedReportTpl.slice(0, tableStart) +
    `<sc-if value="{{singleSection}}">` +
    originalTable +
    `</sc-if>` +
    `<sc-if value="{{hasMultipleSections}}">` +
    sectionTable +
    `</sc-if>` +
    fittedReportTpl.slice(photosStart);
}

// Builder: the fixed 4-input scan grid becomes a dynamic per-section list the
// client runtime renders into (BuilderClient owns add/remove/edit).
{
  const anchor = builderTpl.indexOf("Moisture scan results");
  const gridStart = builderTpl.indexOf(
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:11px;">',
    anchor,
  );
  if (anchor < 0 || gridStart < 0) {
    throw new Error("embed-design: builder scan-results grid not found");
  }
  // balanced-div scan for the grid's end
  let depth = 0;
  let i = gridStart;
  const tag = /<div\b|<\/div>/g;
  tag.lastIndex = gridStart;
  let end = -1;
  for (let m; (m = tag.exec(builderTpl)); ) {
    depth += m[0] === "</div>" ? -1 : 1;
    if (depth === 0) {
      end = m.index + m[0].length;
      break;
    }
  }
  if (end < 0) throw new Error("embed-design: unbalanced scan-results grid");
  builderTpl =
    builderTpl.slice(0, gridStart) +
    `<div data-sections-ui></div>` +
    builderTpl.slice(end);

  builderTpl = builderTpl.replace(
    "Enter how many 100-SF squares fell in each band.",
    "Enter how many 100-SF squares fell in each band. Add a section for each roof area — totals roll up automatically.",
  );

  // The roof-facts "Sections" count is derived from the list below.
  builderTpl = builderTpl.replace(
    '<input type="number" min="0" data-key="sections"',
    '<input type="number" min="0" readonly title="Calculated from the scan sections" data-key="sections"',
  );
  if (!builderTpl.includes('readonly title="Calculated from the scan sections"')) {
    // the sections input may not be type=number — fall back to the data-key anchor
    builderTpl = builderTpl.replace(
      /<input([^>]*data-key="sections")/,
      "<input readonly title=\"Calculated from the scan sections\"$1",
    );
  }
  if (!builderTpl.includes("data-sections-ui")) {
    throw new Error("embed-design: sections UI placeholder missing after transform");
  }
}

// --- emit -------------------------------------------------------------------

const banner =
  "// GENERATED by scripts/embed-design.mjs — do not edit by hand.\n" +
  "// Source of truth: lib/design/{report,builder}.html + {fonts,base}.css\n" +
  "// (extracted from the Claude Design file `MC Scan Report Generator.html`).\n";

const out =
  banner +
  `export const FONTS_CSS = ${JSON.stringify(fontsCss)};\n` +
  `export const BASE_CSS = ${JSON.stringify(baseCss)};\n` +
  `export const PRINT_FIX_CSS = ${JSON.stringify(printFixCss)};\n` +
  `export const REPORT_TPL = ${JSON.stringify(fittedReportTpl)};\n` +
  `export const BUILDER_TPL = ${JSON.stringify(builderTpl)};\n`;

writeFileSync(join(root, "lib/design/embedded.ts"), out);
console.log(
  `embed-design: wrote lib/design/embedded.ts (${(out.length / 1024).toFixed(0)} KiB)`,
);
