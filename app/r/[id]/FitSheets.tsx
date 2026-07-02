"use client";

import { useEffect } from "react";
import { fitSheets } from "@/lib/design/fit";

/** Runs the shrink-to-fit pass on the server-rendered report sheets. */
export default function FitSheets() {
  useEffect(() => {
    const run = () => fitSheets(document);
    run();
    // web fonts change metrics — re-run once they settle
    if (document.fonts?.ready) void document.fonts.ready.then(run);
  }, []);
  return null;
}
