import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { BASE_PATH, frItHosts, siteForHost, siteUrl } from '@/lib/site.ts'
import { CH_FR_IT_URL, LOCAL_SITES, SITES } from '@/lib/site/config.ts'

const LOCAL_PRIVATE = ['/callback/', '/resultat', '/freigeschaltet']

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get('host') ?? '').split(':')[0]
  const own = siteForHost(host)
  const b = BASE_PATH
  const disallow = own
    ? [`${b}/api/`, ...LOCAL_PRIVATE.map((p) => `${b}${p}`)]
    : [
        `${b}/api/`,
        `${b}/callback/`,
        `${b}/results`,
        `${b}/unlocked`,
        ...LOCAL_SITES.flatMap((s) => [...LOCAL_PRIVATE.map((p) => `${b}/${SITES[s].mount}${p}`), `${b}/${SITES[s].domainMount}/`]),
      ]
  const sitemap = frItHosts().includes(host.toLowerCase()) ? `${CH_FR_IT_URL}/sitemap.xml` : own ? (SITES[own].domainUrl ? siteUrl(own, '/sitemap.xml') : `https://${host}${b}/sitemap.xml`) : siteUrl('global', '/sitemap.xml')
  return { rules: [{ userAgent: '*', allow: '/', disallow }], sitemap }
}
