/** Recognise tagged ad arrivals, without cookies or a dependency on analytics consent. */
export function isGoogleAdsEntry(params: Pick<URLSearchParams, 'get'>): boolean {
  if (['gclid', 'gbraid', 'wbraid'].some((key) => params.get(key)?.trim())) return true
  const source = params.get('utm_source')?.trim().toLowerCase()
  const medium = params.get('utm_medium')?.trim().toLowerCase()
  return source === 'google' && ['cpc', 'ppc', 'paidsearch', 'paid_search', 'paid-search', 'cpm', 'display'].includes(medium ?? '')
}
