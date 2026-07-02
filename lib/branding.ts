/**
 * Central branding config for the report + app chrome.
 *
 * Swap these values (and drop real logo assets into /public) once the official
 * Allstar and Roof MRI brand assets are provided. Nothing else needs to change.
 */
export const branding = {
  company: "Allstar",
  product: "Roof MRI",
  reportTitle: "Roof MRI Inspection Report",
  tagline: "Advanced roof moisture & condition analysis",
  // Contact block shown in the report footer (informational only — the app
  // does not send anything).
  contact: {
    phone: "",
    email: "",
    website: "roof-mri.com",
  },
  colors: {
    navy: "#0b2545",
    blue: "#13a0e6",
    mist: "#eef4fb",
  },
  /** Optional logo paths under /public. Leave empty to render a text wordmark. */
  logos: {
    allstar: "", // e.g. "/allstar-logo.svg"
    roofMri: "", // e.g. "/roof-mri-logo.svg"
  },
} as const;
