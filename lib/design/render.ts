/**
 * Minimal renderer for the Claude Design template dialect used by the MC Scan
 * report (lib/design/report.html, builder.html):
 *
 *   {{path.to.value}}                          — interpolation (HTML-escaped)
 *   <sc-for list="{{items}}" as="x">…</sc-for> — loops ({{x.field}} in scope)
 *   <sc-if value="{{flag}}">…</sc-if>          — conditionals
 *
 * `hint-placeholder-*` attributes are design-tool hints and are ignored.
 * sc-if may appear inside sc-for (the "Recommended" badge); same-tag nesting
 * does not occur in these templates.
 *
 * Every interpolated value is HTML-entity-escaped, including quotes, so user
 * text can never break out of an attribute or inject markup (values landing in
 * style="" attributes survive because browsers entity-decode attribute values
 * before CSS parsing). Keys listed in opts.rawKeys skip escaping — use only
 * for app-generated markup, never for user data.
 */

export interface RenderOptions {
  /** Keys whose values are trusted HTML and must not be escaped. */
  rawKeys?: ReadonlySet<string>;
}

type Scope = Record<string, unknown>;

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function lookup(path: string, scopes: Scope[]): unknown {
  const trimmed = path.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  const [head, ...rest] = trimmed.split(".");
  for (let i = scopes.length - 1; i >= 0; i--) {
    if (head in scopes[i]) {
      let v: unknown = scopes[i][head];
      for (const part of rest) {
        if (v == null) return undefined;
        v = (v as Record<string, unknown>)[part];
      }
      return v;
    }
  }
  return undefined;
}

const SC_FOR_RE =
  /<sc-for\s+list="\{\{([^}]+)\}\}"\s+as="(\w+)"[^>]*>([\s\S]*?)<\/sc-for>/g;
const SC_IF_RE = /<sc-if\s+value="\{\{([^}]+)\}\}"[^>]*>([\s\S]*?)<\/sc-if>/g;
const PLACEHOLDER_RE = /\{\{([^}]+)\}\}/g;

function renderChunk(tpl: string, scopes: Scope[], opts: RenderOptions): string {
  let out = tpl.replace(SC_FOR_RE, (_m, listPath: string, alias: string, body: string) => {
    const list = lookup(listPath, scopes);
    if (!Array.isArray(list)) return "";
    return list
      .map((item) => renderChunk(body, [...scopes, { [alias]: item }], opts))
      .join("");
  });

  out = out.replace(SC_IF_RE, (_m, condPath: string, body: string) =>
    lookup(condPath, scopes) ? renderChunk(body, scopes, opts) : "",
  );

  out = out.replace(PLACEHOLDER_RE, (_m, path: string) => {
    const v = lookup(path, scopes);
    if (v == null) return "";
    const s = typeof v === "string" ? v : String(v);
    return opts.rawKeys?.has(path.trim()) ? s : escapeHtml(s);
  });

  return out;
}

export function renderTemplate(
  tpl: string,
  values: Scope,
  opts: RenderOptions = {},
): string {
  return renderChunk(tpl, [values], opts);
}
