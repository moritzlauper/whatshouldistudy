import { CONTACT, SITE_NAME, SOURCE_URL, siteUrl } from '@/lib/site.ts'
import { SITES } from '@/lib/site/config.ts'
import type { SiteId } from '@/lib/site/config.ts'
import { dict } from '@/lib/site/dict.ts'
import { pageUrl } from '@/lib/site/meta.ts'

/** Structured data for search engines; `<` is escaped so no string can close the script tag. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', ...data }).replace(/</g, '\\u003c') }} />
}

const ORG_ID = `${siteUrl('global')}#organization`

/** Home page: who runs it, the site itself and its questions. */
export function homeLd(site: SiteId, faq: ReadonlyArray<readonly [string, string]>) {
  const c = SITES[site]
  const url = pageUrl(site, (r) => r.home)
  return {
    '@graph': [
      { '@type': 'Organization', '@id': ORG_ID, name: SITE_NAME, url: siteUrl('global'), logo: siteUrl('global', '/icon-512.png'), email: CONTACT, sameAs: [SOURCE_URL] },
      { '@type': 'WebSite', '@id': `${url}#website`, name: c.name, url, inLanguage: c.intl, description: dict(c.locale).meta.description, publisher: { '@id': ORG_ID } },
      { '@type': 'FAQPage', '@id': `${url}#faq`, inLanguage: c.intl, mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  }
}

/** Field page: home › all fields › this field. */
export function fieldLd(site: SiteId, id: string, name: string) {
  const c = SITES[site]
  const crumbs: Array<[string, string]> = [
    [c.name, pageUrl(site, (r) => r.home)],
    [dict(c.locale).meta.fields, pageUrl(site, (r) => r.fields)],
    [name, pageUrl(site, (r) => r.field(id))],
  ]
  return { '@type': 'BreadcrumbList', itemListElement: crumbs.map(([n, item], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item })) }
}

/** Any page by its trail of [name, url] from the home page. */
export function breadcrumbLd(crumbs: Array<[string, string]>) {
  return { '@type': 'BreadcrumbList', itemListElement: crumbs.map(([n, item], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item })) }
}
