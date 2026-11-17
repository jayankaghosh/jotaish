// Tells Android that the Jotaish app (android/) may open this site full
// screen. The app's signing-key fingerprints come from the environment:
// ANDROID_CERT_FINGERPRINTS="AA:BB:...,CC:DD:..." (SHA-256, comma-separated).
export const dynamic = 'force-dynamic';

export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_FINGERPRINTS ?? '')
    .split(',')
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean);
  const body = fingerprints.length
    ? [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: { namespace: 'android_app', package_name: process.env.ANDROID_PACKAGE ?? 'online.jotaish.app', sha256_cert_fingerprints: fingerprints },
        },
      ]
    : [];
  return Response.json(body, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
