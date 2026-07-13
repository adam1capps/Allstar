# Allstar MC Scan Report Generator

The MC Scan (Roof MRI) report builder for Allstar. Fill the form, watch the
client report update live, and click **Create shareable link** to get a
**permanent, unique URL** to send to the client. The client's link shows the
full styled report with **Print / Save as PDF** — every sheet is exactly one
US-Letter page, no blank pages, no spill-over.

The report and builder UI come **directly from the Claude Design file
`MC Scan Report Generator.html`** — its extracted templates live in
`lib/design/` and are rendered verbatim, so the app always matches the design.

## How it works

| Piece | What it does |
| --- | --- |
| `/builder` | The design's own MC Scan generator UI: form on top, live report preview below. Adds a **Create shareable link** action (password-protected) plus the design's Print / Download report / Save job / Load job / Reset actions. |
| `/r/<id>` | Permanent public report link (server-rendered). Unguessable 12-char id. Print / Save as PDF built in. |
| `POST /api/reports` | Validates and stores a report in **Netlify Blobs**; returns `{ id, path }`. Gated by the `BUILDER_PASSWORD` env var (header `x-builder-password`). |
| `POST /api/reports/<id>/findings` | The client's one-shot findings submission (see below) — locks the report permanently. |
| `GET /api/reports/<id>` | Raw report JSON (used for future Roof MRI App / Allstar Chart integration). |

### Multi-section scans

The builder's Moisture scan results is a per-section list (**+ Add section**,
name + wet/damp/dry/undetermined squares each). All report stats — the
"What the scan found" card, total surveyed, percentages — automatically become
the **entire-property overall**, and reports with more than one section swap
sheet 07's classification table for a **section-by-section table with an
Entire property total row**. Single-section reports render exactly as the
original design. (`scanSections` in the API payload; the flat `wetSq…undSq`
fields still work and are stored as the property-wide sums.)

### Client-completed findings

Checking **"Client fills in the findings"** in the Create-link dialog stores
the report with the Findings & diagnosis section blank and unlocked. The
permanent link then opens with a "Complete the findings" panel (moisture
analysis, diagnosis headline/detail, recommended option) above the
live-updating report; everything else is locked. Saving requires an explicit
confirmation and **locks the report permanently** — enforced server-side
(`409` on any later submission). No password is involved: possession of the
unguessable link is the credential, same as viewing.

### Report branding (Roof MRI vs Allstar)

The 11-sheet report design is contractor-neutral in everything but its **brand
chrome** — the logo/wordmark, the running-header name + tagline, the footer
line, the contact block, the back-cover copy, and the single accent color.
Those live in `lib/branding.ts` as `Brand` profiles, and the report picks one
via an optional **`brand`** field on the report data:

- **`allstar`** — the Allstar account's report (red accent, Allstar wordmark +
  contact). This is the **default** for any brandless report, so every existing
  report and Allstar's own builder are unchanged.
- **`roofmri`** — the generic Roof MRI report every other contractor runs on
  (navy accent, Roof MRI three-square mark, roof-mri.com contact). The Roof MRI
  app sends `brand: "roofmri"` on `POST /api/reports`.

Only the moisture **data** palette (wet / damp / dry) is off-limits — color
there is state, not brand, so it never varies. Adding a contractor is a new
entry in `BRANDS`; the shared 11-sheet layout is the single source of truth.
The deployment default can be flipped with the `DEFAULT_REPORT_BRAND` env var.

## The design pipeline

```
lib/design/report.html    ← 12 report sheets (extracted from Claude Design)
lib/design/builder.html   ← builder form panel  (extracted from Claude Design)
lib/design/fonts.css      ← self-hosted Exo + Open Sans (@font-face)
lib/design/base.css       ← design base + print rules
lib/design/print-fix.css  ← ours: locks every sheet to exactly one Letter page
        │
        ▼  npm run embed-design   (scripts/embed-design.mjs — runs pre-dev/build)
lib/design/embedded.ts    ← generated TS module the app imports
```

The templates use the design's own dialect — `{{value}}`,
`<sc-for list="{{rows}}" as="r">`, `<sc-if value="{{flag}}">` — rendered by
`lib/design/render.ts` (all user values HTML-escaped; photos restricted to
uploaded `data:image/*` payloads or the bundled sample paths).

`lib/mcscan.ts` is the TypeScript port of the design's own `renderVals()`
logic: squares → SF → percentages, breakdown tables, option cards, fixed
marketing/legal content. One source of truth feeds the builder preview and the
permanent link, so they always match.

### Print quality (the hard part)

Report sheets are 816×1056 px (US Letter @ 96dpi). Two defenses keep the PDF
clean:

- `lib/design/print-fix.css` — hard-locks each sheet to exactly one page
  (fixed height, overflow clipped, one break per sheet, no fragmentation
  inside sheets, Next.js route announcer hidden).
- `lib/design/fit.ts` — if a job's analysis/diagnosis text (or the photos) push
  a sheet past its page, tagged text steps down to a floor font size, then the
  whole sheet gets a compensated `zoom` so **nothing is ever clipped**.

Verify any report URL end-to-end:

```bash
node scripts/pdf-check.mjs http://localhost:3000/r/<id> out.pdf
# → sheets == pdf pages, and no sheet content past its page edge
```

## Local development

```bash
npm install
npm run dev        # http://localhost:3000 (embed-design runs automatically)
```

Outside Netlify, reports persist in memory only (reset on restart). On Netlify,
**Netlify Blobs** stores them permanently — no configuration needed.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `BUILDER_PASSWORD` | Required to create reports (asked once per session in the builder). If unset, creation is open — set it in Netlify for production. |

## Deploying (Netlify)

Connected to this repo's `main`. `netlify.toml` handles build config. After
changing env vars, redeploy. Custom domain: add `allstar.roof-mri.com` under
Domain management + a CNAME at the DNS for `roof-mri.com`.

## Updating the design

When the Claude Design file changes: re-extract the report/builder markup into
`lib/design/*.html` (see `scripts/embed-design.mjs` header notes), keep the
`{{placeholders}}` intact, and run `npm run embed-design`. If new fields are
added, extend `McScanData` + `SAMPLE` + validation in `lib/mcscan.ts` — the
templates pick them up by placeholder name.

## Future integration

The Roof MRI App / Allstar Chart can file reports directly by POSTing the
`McScanData` shape (see `lib/mcscan.ts`) to `/api/reports` — same viewer, same
permanent links, no UI changes needed.

### Report PDFs

Every final report has a real PDF at **`/r/<id>/pdf`** — rendered by headless
Chromium (one Letter page per sheet, identical to Print / Save as PDF), cached
in Blobs, and regenerated automatically when a report is edited. Reports still
awaiting the client's findings return 409 until completed. Surfaced as
**Download PDF** on the report page, in the create-link dialog, and on the
Reports page.

### Reports page

**`/builder/reports`** (builder password) lists every created report with its
status (Final / Awaiting findings), the permanent link, the PDF download, and
**Edit**.

### Editing a report

**Edit** opens the report back in the builder (`/builder?edit=<id>`) — change
photos, sections, numbers, text, anything — and **Save changes** updates the
same permanent link (clients keep their URL; the PDF regenerates). Handled by
`PUT /api/reports/<id>` (password-gated). The client-findings lock applies to
the client's one-shot submission; the password holder can always correct a
report.

### Client photo uploads

When completing the findings, the client can also replace the four evidence
photos (same drag/drop + compression as the builder) and edit their captions —
all live-previewed and locked in with the findings.
