'use client'

import { withBase } from '@/lib/site.ts'
import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/pricing.ts'
import type { Price as PriceT } from '@/lib/pricing.ts'
import type { ConsentRule } from '@/lib/measure.ts'
import type { SiteId } from '@/lib/site/config.ts'
import { SITES } from '@/lib/site/config.ts'

export interface Config {
  payments: 'stripe' | 'free' | 'off'
  price: PriceT
  consent: ConsentRule
}

const cached = new Map<SiteId, Promise<Config>>()

/** Payment mode, site price and visitor consent rule, cached separately per site. */
export function fetchConfig(site: SiteId): Promise<Config> {
  let request = cached.get(site)
  if (!request) {
    request = fetch(withBase(`/api/config?site=${site}`)).then((r) => {
      if (!r.ok) throw new Error('Could not load site configuration.')
      return r.json() as Promise<Config>
    }).catch((error) => {
      cached.delete(site)
      throw error
    })
    cached.set(site, request)
  }
  return request
}

export function useConfig(site: SiteId): Config | null {
  const [loaded, setLoaded] = useState<{ site: SiteId; config: Config } | null>(null)
  useEffect(() => {
    let active = true
    fetchConfig(site)
      .then((config) => { if (active) setLoaded({ site, config }) })
      .catch(() => {})
    return () => { active = false }
  }, [site])
  return loaded?.site === site ? loaded.config : null
}

/** «CHF 17» or «€17», using the same currency as checkout. */
export function Price({ site }: { site: SiteId }) {
  const config = useConfig(site)
  const conf = SITES[site]
  const price = config?.price ?? { currency: conf.currency, amount: 17 }
  return <span>{formatPrice(price, conf.intl)}</span>
}
