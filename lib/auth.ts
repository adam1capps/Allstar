/**
 * Minimal shared-password gate for the builder (report creation).
 *
 * The public report viewer is intentionally NOT gated — it is reached only via
 * an unguessable link. Only creating a report requires the password, checked
 * server-side against BUILDER_PASSWORD.
 *
 * If BUILDER_PASSWORD is unset (e.g. first local run), the gate is open so the
 * app is immediately usable; set it in Netlify env vars for production.
 */
export const BUILDER_PASSWORD_HEADER = "x-builder-password";

export function isBuilderAuthorized(provided: string | null): boolean {
  const expected = process.env.BUILDER_PASSWORD;
  if (!expected) return true; // no password configured -> open
  return provided === expected;
}

export function isBuilderPasswordConfigured(): boolean {
  return Boolean(process.env.BUILDER_PASSWORD);
}
