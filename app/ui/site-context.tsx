'use client'

import { createContext, useContext, useMemo } from 'react'
import { configureStore } from '@/lib/store.ts'
import { SITES } from '@/lib/site/config.ts'
import type { SiteId } from '@/lib/site/config.ts'
import { kit } from '@/lib/site/kit.ts'
import type { Kit } from '@/lib/site/kit.ts'

const Ctx = createContext<Kit>(kit('global', ''))

/** Gives client components the site's language, links and storage. */
export function SiteProvider({ site, base, children }: { site: SiteId; base: string; children: React.ReactNode }) {
  // Before any child reads the store: each site keeps its own data.
  configureStore(SITES[site].storeKey, SITES[site].defaultPrefs)
  const value = useMemo(() => kit(site, base), [site, base])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSite(): Kit {
  return useContext(Ctx)
}
