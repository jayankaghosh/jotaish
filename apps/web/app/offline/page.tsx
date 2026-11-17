'use client';

import { NoInternet } from '@/components/Pwa';

// Served by the service worker for any page that can't load offline.
export default function OfflinePage() {
  return <NoInternet />;
}
