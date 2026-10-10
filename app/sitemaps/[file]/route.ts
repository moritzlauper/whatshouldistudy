import type { NextRequest } from 'next/server'
import { programmeSlug } from '@/lib/catalogue.ts'
import { getCatalogue, getMeta } from '@/lib/server/data.ts'
import type { Routes } from '@/lib/site/config.ts'
import { catalogueLanguages, pageUrl } from '@/lib/site/meta.ts'
import { perFile, sitemapFile, sitemapXml } from '@/lib/site/sitemaps.ts'

/** One part of the programme pages' sitemap of this host (see lib/site/sitemaps.ts). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  const host = (req.headers.get('host') ?? req.nextUrl.host).split(':')[0].toLowerCase()
  const found = sitemapFile(host, (await ctx.params).file)
  if (!found) return new Response('Not found', { status: 404 })
  const { group, part } = found
  const [{ sample }, catalogue] = await Promise.all([getMeta(), getCatalogue(group.country)])
  // The demo data has no real pages to list.
  if (sample || !catalogue) return new Response('Not found', { status: 404 })
  const per = perFile(group)
  const programmes = catalogue.programmes.slice(part * per, (part + 1) * per)
  if (!programmes.length && part > 0) return new Response('Not found', { status: 404 })
  const urls = programmes.flatMap((p) => {
    const page = (r: Routes) => r.programme(group.country, p.fields[0], programmeSlug(p))
    const languages = catalogueLanguages(group.country, page)
    // x-default and English alone add nothing to the address itself.
    const alternates = Object.keys(languages).length > 2 ? languages : undefined
    return group.locales.map((locale) => ({ loc: pageUrl(group.site, page, locale), lastmod: catalogue.updated, alternates }))
  })
  return new Response(sitemapXml(urls), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400' },
  })
}
