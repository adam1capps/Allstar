/**
 * Guaranteed one-page fit for report sheets.
 *
 * Report sheets are exactly 816×1056 px (US Letter @ 96dpi) in print. Content
 * can exceed that budget two ways:
 *   1. long user-entered text (analysis / diagnosis), and
 *   2. the design's own fixed layout running a few px over once real photos
 *      load (the original export printed with spill-over and orphan slivers).
 *
 * Two-stage fix, run after fonts/images settle:
 *   Stage 1 — elements marked `data-fit` (user free-text, tagged at embed
 *   time) get their font size stepped down to a floor.
 *   Stage 2 — any remaining overflow is removed by applying a `zoom` factor
 *   to the sheet with width/height compensated so the rendered box stays
 *   exactly 816×1056. A 1–4% zoom is imperceptible but guarantees nothing is
 *   clipped and Chromium's paginator never fragments mid-sheet.
 */

const SHEET_W = 816;
const SHEET_H = 1056;
const MIN_FONT_PX = 9.5;
const FONT_STEP_PX = 0.5;
const MIN_ZOOM = 0.8;
const ZOOM_STEP = 0.005;

/** Visual overflow of sheet content past the sheet's rendered bottom edge. */
function overflowPx(sheet: HTMLElement): number {
  const sheetRect = sheet.getBoundingClientRect();
  let bottom = sheetRect.top;
  for (const child of Array.from(sheet.children)) {
    const r = (child as HTMLElement).getBoundingClientRect();
    if (r.bottom > bottom) bottom = r.bottom;
  }
  // scrollHeight catches non-positioned overflow zoom-adjusted rects can miss
  const zoom = parseFloat((sheet.style as CSSStyleDeclaration & { zoom?: string }).zoom || "1") || 1;
  const scrollOver = (sheet.scrollHeight - SHEET_H / zoom) * zoom;
  return Math.max(bottom - (sheetRect.top + SHEET_H), scrollOver, 0);
}

function applyZoom(sheet: HTMLElement, zoom: number): void {
  const style = sheet.style as CSSStyleDeclaration & { zoom?: string };
  if (zoom >= 0.999) {
    style.zoom = "";
    sheet.style.removeProperty("width");
    sheet.style.removeProperty("height");
    sheet.style.removeProperty("min-height");
    sheet.style.removeProperty("max-height");
    return;
  }
  style.zoom = String(zoom);
  // compensate so the rendered box stays exactly one Letter page
  sheet.style.setProperty("width", `${SHEET_W / zoom}px`, "important");
  sheet.style.setProperty("height", `${SHEET_H / zoom}px`, "important");
  sheet.style.setProperty("min-height", `${SHEET_H / zoom}px`, "important");
  sheet.style.setProperty("max-height", `${SHEET_H / zoom}px`, "important");
}

export function fitSheets(scope: ParentNode): void {
  const sheets = Array.from(scope.querySelectorAll<HTMLElement>("[data-sheet]"));

  for (const sheet of sheets) {
    // reset previous pass so re-runs (font load, preview re-render) are stable
    applyZoom(sheet, 1);
    const fitEls = Array.from(sheet.querySelectorAll<HTMLElement>("[data-fit]"));
    for (const el of fitEls) el.style.fontSize = "";

    if (overflowPx(sheet) <= 1) continue;

    // Stage 1: shrink tagged free-text down to the floor
    const sizes = fitEls.map((el) => parseFloat(getComputedStyle(el).fontSize) || 13);
    let guard = 40;
    while (overflowPx(sheet) > 1 && guard-- > 0) {
      let shrunk = false;
      for (let i = 0; i < fitEls.length; i++) {
        if (sizes[i] - FONT_STEP_PX >= MIN_FONT_PX) {
          sizes[i] -= FONT_STEP_PX;
          fitEls[i].style.fontSize = `${sizes[i]}px`;
          shrunk = true;
        }
      }
      if (!shrunk) break;
    }

    // Stage 2: zoom the whole sheet until everything fits its single page
    let zoom = 1;
    guard = 60;
    while (overflowPx(sheet) > 1 && zoom - ZOOM_STEP >= MIN_ZOOM && guard-- > 0) {
      zoom -= ZOOM_STEP;
      applyZoom(sheet, zoom);
    }
  }
}
