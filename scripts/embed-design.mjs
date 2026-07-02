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
