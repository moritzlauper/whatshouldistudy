import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { CH_URL, SITE_URL, chHosts, chUrl } from '@/lib/site.ts'
import { FIELDS } from '@/lib/taxonomy/fields.ts'

const CH_PAGES = ['', '/start', '/so-funktionierts', '/faecher', ...FIELDS.map((f) => `/faecher/${f.id}`), '/datenschutz', '/agb']

/** One sitemap per host: the Swiss domain lists the Swiss pages, the global one the rest. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const host = ((await headers()).get('host') ?? '').split(':')[0].toLowerCase()
  const onSwissHost = chHosts().includes(host)
  const url = (p: string) => (onSwissHost && !CH_URL ? `https://${host}${p || '/'}` : chUrl(p))
  const swiss = CH_PAGES.map((p) => ({ url: url(p), lastModified: now, priority: p === '' ? 1 : p.startsWith('/faecher/') ? 0.6 : 0.7 }))
  if (onSwissHost) return swiss
  return [
    { url: `${SITE_URL}/`, lastModified: now, priority: 1 },
    { url: `${SITE_URL}/start`, lastModified: now, priority: 0.9 },
    { url: `${SITE_URL}/how-it-works`, lastModified: now, priority: 0.7 },
    { url: `${SITE_URL}/fields`, lastModified: now, priority: 0.8 },
    ...FIELDS.map((f) => ({ url: `${SITE_URL}/fields/${f.id}`, lastModified: now, priority: 0.6 })),
    { url: `${SITE_URL}/privacy`, lastModified: now, priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified: now, priority: 0.2 },
    // Until the Swiss site has its own domain, its pages are part of this one.
    ...(CH_URL ? [] : swiss),
  ]
}
