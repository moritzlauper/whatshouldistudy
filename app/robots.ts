import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { CH_URL, SITE_URL, chHosts, chUrl } from '@/lib/site.ts'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get('host') ?? '').split(':')[0].toLowerCase()
  const swiss = chHosts().includes(host)
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: swiss
          ? ['/api/', '/callback/', '/resultat', '/freigeschaltet']
          : ['/api/', '/callback/', '/results', '/unlocked', '/schweiz/callback/', '/schweiz/resultat', '/schweiz/freigeschaltet', '/ch-site/'],
      },
    ],
    sitemap: swiss ? (CH_URL ? chUrl('/sitemap.xml') : `https://${host}/sitemap.xml`) : `${SITE_URL}/sitemap.xml`,
  }
}
