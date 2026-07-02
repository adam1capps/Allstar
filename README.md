# Allstar MC Scan Report Generator

The MC Scan (Roof MRI) report builder for Allstar. Fill the form, watch the
12-page client report update live, and click **Create shareable link** to get a
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
| `GET /api/reports/<id>` | Raw report JSON (used for future Roof MRI App / Allstar Chart integration). |

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
