import { SITES, routes } from './config.ts'
import type { SiteId } from './config.ts'
import { dict } from './dict.ts'

/** Everything a view needs to render for one site. */
export function kit(site: SiteId, base: string) {
  const conf = SITES[site]
  return { site, base, conf, locale: conf.locale, intl: conf.intl, t: dict(conf.locale), r: routes(site, base) }
}

export type Kit = ReturnType<typeof kit>

/** The Swiss pages are mounted twice: /schweiz on the global domain, and an internal path the Swiss domain is rewritten to. */
export const CH_MOUNTS = { public: 'schweiz', domain: 'ch-site' } as const

export function chBase(mount: string): string {
  return mount === CH_MOUNTS.domain ? '' : `/${CH_MOUNTS.public}`
}
