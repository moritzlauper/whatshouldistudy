/** Countries whose programme sources are enabled; DE/AT await permission. */
export const PROGRAMME_COUNTRIES = ['CH', 'FR', 'GB', 'NL', 'NO', 'FI', 'AU', 'KR', 'US'] as const

export function programmeCountry(value: string): string {
  const country = value.trim().toUpperCase().replace(/^UK$/, 'GB')
  if (!(PROGRAMME_COUNTRIES as readonly string[]).includes(country)) throw new Error(`Unsupported programme country: ${value}`)
  return country
}
