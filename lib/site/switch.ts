import { siteUrl } from '../site.ts'
import { SITES, isLocal, routes } from './config.ts'
import type { Locale, Routes, SiteId } from './config.ts'

/**
 * The language switch: from the page the browser shows to the same page in
 * another language version. Client-safe, so it takes the field ids instead of
 * importing the taxonomy.
 */

export type Version = { site: SiteId; locale: Locale }
type Page = (r: Routes) => string

function pages(fieldIds: readonly string[]): Page[] {
  return [
    (r) => r.home,
    (r) => r.start,
    (r) => r.results,
    (r) => r.how,
    (r) => r.fields,
    ...fieldIds.map((id): Page => (r) => r.field(id)),
    (r) => r.teachers,
    (r) => r.orgs,
    (r) => r.orgWelcome,
    (r) => r.unlocked,
    (r) => r.privacy,
    (r) => r.terms,
    (r) => r.imprint,
  ]
}

/** Link to the page at `path` in another version: relative on the same domain, absolute across domains. */
export function switchHref(from: Version & { base: string }, to: Version, path: string, fieldIds: readonly string[]): string {
  const page = pages(fieldIds).find((p) => p(routes(from.site, from.base, from.locale)) === path) ?? ((r: Routes) => r.home)
  if (to.site === from.site) return page(routes(to.site, from.base, to.locale))
  const ownDomain = isLocal(from.site) && from.base === ''
  if (ownDomain || SITES[to.site].domainUrl) {
    const p = page(routes(to.site, '', to.locale))
    return siteUrl(to.site, p === '/' ? '' : p)
  }
  return page(routes(to.site, isLocal(to.site) ? `/${SITES[to.site].mount}` : '', to.locale))
}
