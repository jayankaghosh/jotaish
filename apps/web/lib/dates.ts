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
