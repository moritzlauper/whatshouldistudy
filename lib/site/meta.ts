import type { Metadata } from 'next'
import { siteUrl } from '../site.ts'
import { mountInfo } from './kit.ts'
import { dict } from './dict.ts'
import { SITES } from './config.ts'
import type { Dict } from './dict.ts'

/** Title, description and canonical link of a country-site page. */
export async function localMeta(params: Promise<{ mount: string }>, path: string, pick: (t: Dict) => { title?: string; description?: string; index?: boolean }): Promise<Metadata> {
  const { mount } = await params
  const { site } = mountInfo(mount)
  const t = dict(SITES[site].locale)
  const m = pick(t)
  return {
    title: m.title,
    description: m.description,
    alternates: { canonical: siteUrl(site, path) },
    ...(m.index === false ? { robots: { index: false } } : {}),
  }
}
