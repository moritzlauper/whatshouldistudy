/**
 * Countries whose programme pages the facts run reads. Germany awaits
 * permission. Austria: only the universities that agreed in writing
 * (scrapers/sites/at-permitted.ts); the rest of the Austrian list comes from
 * the open national dataset, whose licence doesn't cover the universities' pages.
 */
export const PROGRAMME_COUNTRIES = ['CH', 'FR', 'GB', 'NL', 'NO', 'FI', 'AU', 'KR', 'US', 'AT'] as const

/** Austrian universities whose programme pages may be read, as named in lib/at-institutions.ts. */
export const AT_READABLE = ['Johannes Kepler Universität Linz', 'Universität Graz']

/** Whether the facts run may read this programme's page. */
export const mayReadPage = (r: { country: string; institution?: string }) => r.country !== 'AT' || AT_READABLE.includes(r.institution ?? '')

export function programmeCountry(value: string): string {
  const country = value.trim().toUpperCase().replace(/^UK$/, 'GB')
  if (!(PROGRAMME_COUNTRIES as readonly string[]).includes(country)) throw new Error(`Unsupported programme country: ${value}`)
  return country
}
