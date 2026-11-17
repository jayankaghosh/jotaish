export interface Place {
  name: string;
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

// Open-Meteo geocoding is free and returns the IANA time zone we need.
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&format=json&name=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: any[] };
  return (json.results ?? [])
    .filter((r) => r.timezone)
    .map((r) => ({
      name: r.name,
      label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone,
    }));
}
