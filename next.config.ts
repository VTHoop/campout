import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The planner is a workspace package of untranspiled TypeScript (ADR-0008).
  transpilePackages: ['@campout/planner'],
  typedRoutes: true,
  // The Playwright smoke lane drives the dev server over 127.0.0.1, which Next 16
  // treats as cross-origin and blocks. Dev-only; has no effect on a production build.
  allowedDevOrigins: ['127.0.0.1'],
};

export default config;
