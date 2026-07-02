# Allstar Roof MRI Report Builder

A small web app that lets Allstar generate a **Roof MRI report** and hand the
client a **permanent, unique link** to view and download it as a PDF. The app
only *generates* the report — it does not send anything.

> **Report layout note:** The current report layout is a first-pass "standard"
> structure. The intended final layout comes from the Claude Design file
> **`MC Scan Report Generator.html`**. Because Claude Design requires an
> interactive login that isn't available in the remote build environment, that
> design could not be imported automatically — see
> [Importing the MC Scan design](#importing-the-mc-scan-design) below. The
> persistence, link generation, builder form, and PDF flow are all
> design-agnostic, so swapping in the final layout only touches the report
> viewer.

## How it works

- **Builder** (`/builder`) — a password-gated form where an inspector enters the
  report details and photos, then clicks **Generate**. On submit the report is
  saved and a permanent link is returned with a copy button.
- **Report viewer** (`/r/<id>`) — a public, styled report page reached only via
  the unguessable link. A **Download PDF** button prints the page to PDF using a
  print stylesheet (the web page is the single source of truth).
- **Persistence** — reports are stored in **Netlify Blobs**. Each report gets an
  unguessable 12-character id, which is what makes the shared link safe to send.

## Tech stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Netlify Blobs (`@netlify/blobs`) via the Next.js runtime on Netlify
- `nanoid` for unguessable report ids

## Project structure

```
app/
  page.tsx                 landing page
  builder/page.tsx         password-gated report builder form
  r/[id]/page.tsx          public report viewer (server-rendered)
  r/[id]/PrintButton.tsx   client-side "Download PDF" button
  api/reports/route.ts     POST -> create + save report, returns { id, path }
  api/reports/[id]/route.ts GET  -> fetch a report
lib/
  report.ts                report types, id generation, validation
  store.ts                 Netlify Blobs persistence (+ in-memory dev fallback)
  branding.ts              brand tokens (colors, logos, contact) — swap for real assets
  auth.ts                  shared-password gate for the builder
```

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
```

Outside the Netlify CLI, `lib/store.ts` falls back to an **in-memory** store so
the app runs locally — data resets on restart (fine for testing the form and
viewer). For durable local storage backed by real Blobs, run with the Netlify
CLI: `netlify dev`.

## Environment variables

| Variable           | Purpose                                                        |
| ------------------ | ------------------------------------------------------------- |
| `BUILDER_PASSWORD` | Shared password required to create reports at `/builder`. If unset, the builder is open (intended only for first local runs). Set this in Netlify. |

Netlify Blobs requires no configuration — it is provisioned automatically for
the site.

## Deploying to Netlify

1. In Netlify, **Add new site → Import an existing project**, and connect this
   GitHub repo.
2. Build settings are read from `netlify.toml` (build command `npm run build`,
   the Next.js runtime plugin handles the rest). No changes needed.
3. Under **Site configuration → Environment variables**, add `BUILDER_PASSWORD`.
4. Deploy.

### Custom domain (`allstar.roof-mri.com`)

1. In Netlify: **Domain management → Add a domain** → enter
   `allstar.roof-mri.com`.
2. At your DNS provider for `roof-mri.com`, add a **CNAME** record for the
   `allstar` subdomain pointing to your Netlify site (Netlify shows the exact
   target). Netlify then provisions HTTPS automatically.

## Importing the MC Scan design

The final report layout lives in Claude Design as `MC Scan Report Generator.html`
(project `0ddab6c7-9dcb-41fa-89cd-65cd4880eb67`). To bring it in, do one of:

- In Claude Design, use **"Send to Claude Code Web"** to seed the file into the
  workspace, then it can be adapted into `app/r/[id]/page.tsx`; or
- Export/paste the HTML (or host it at a public URL) so it can be fetched.

Once available, the design becomes the report viewer's markup/styling; the form
fields in `lib/report.ts` and `app/builder/page.tsx` are then aligned to the
exact fields the design expects.

## Future integration

The create endpoint (`POST /api/reports`) accepts the report shape defined in
`lib/report.ts`. The later Roof MRI App / Allstar Chart integration can POST that
same shape to file reports automatically — they will render through the exact
same viewer and produce the same permanent links.
