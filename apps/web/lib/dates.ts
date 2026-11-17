// Dates follow the chosen language; I18nProvider keeps this current.
let dateLocale = 'en-IN';

export function setDateLocale(locale: string) {
  dateLocale = locale;
}

export function formatDate(iso: string, withTime = false) {
  return new Date(iso).toLocaleDateString(dateLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function formatDayMonth(iso: string) {
  return new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' });
}

// "8s" or "2m 05s"; for the time a reading took to write.
export function formatDuration(ms: number) {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}s`;
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, '0')}s`;
}
