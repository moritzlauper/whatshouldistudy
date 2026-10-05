'use client'

import { withBase } from '@/lib/site.ts'
import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/pricing.ts'
import type { Price as PriceT } from '@/lib/pricing.ts'
import type { SiteId } from '@/lib/site/config.ts'
import { SITES } from '@/lib/site/config.ts'

export interface Config {
  payments: 'stripe' | 'free' | 'off'
  price: PriceT
}

let cached: Promise<Config> | null = null

/** Payment mode and the price in the visitor's currency, fetched once per page. */
export function fetchConfig(site: SiteId): Promise<Config> {
  cached ??= fetch(withBase(`/api/config?site=${site}`)).then((r) => r.json() as Promise<Config>)
  return cached
}

export function useConfig(site: SiteId): Config | null {
  const [config, setConfig] = useState<Config | null>(null)
  useEffect(() => {
    fetchConfig(site)
      .then(setConfig)
      .catch(() => {})
  }, [site])
  return config
}

/** «CHF 15» or «€15», in the visitor's currency once known. */
export function Price({ site }: { site: SiteId }) {
  const config = useConfig(site)
  const conf = SITES[site]
  const price = config?.price ?? { currency: conf.currency, amount: 15 }
  return <span>{formatPrice(price, conf.intl)}</span>
}
