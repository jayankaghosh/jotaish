import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Names the service worker's cache, so each release replaces the last.
  env: { NEXT_PUBLIC_BUILD_ID: String(Date.now()) },
};

export default nextConfig;
