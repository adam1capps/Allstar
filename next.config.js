/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Chromium ships compressed binaries loaded from node_modules at runtime;
    // keeping these packages external lets the file tracer include them in
    // the serverless bundle for the PDF route.
    serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
    outputFileTracingIncludes: {
      "/r/[id]/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
      "/r/[id]/pdf/route": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    },
  },
};

module.exports = nextConfig;
