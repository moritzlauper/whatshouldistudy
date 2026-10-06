'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { routes } from '@/lib/site/config.ts'
import { switchHref } from '@/lib/site/switch.ts'
import type { Version } from '@/lib/site/switch.ts'

export type LangOption = Version & { code: string; name: string }

/**
 * DE · FR · IT · EN in the header, each leading to the same page in that
 * language. The server renders links to the home pages; after mount the
 * browser's own path picks the matching page, since proxy.ts rewrites
 * country domains and the prerendered path differs from the address bar.
 */
export function LangSwitch({ from, options, label, fieldIds }: { from: Version & { base: string }; options: LangOption[]; label: string; fieldIds: string[] }) {
  const routed = usePathname()
  const [path, setPath] = useState<string | null>(null)
  useEffect(() => {
    setPath(window.location.pathname.replace(/(.)\/$/, '$1'))
  }, [routed])
  const here = path ?? routes(from.site, from.base, from.locale).home

  return (
    <span role="group" aria-label={label} className="inline-flex items-center rounded-full border-2 border-line p-0.5 text-xs font-bold">
      {options.map((o) =>
        o.site === from.site && o.locale === from.locale ? (
          <span key={o.code} aria-current="true" title={o.name} className="rounded-full bg-ink px-2 py-1 text-bg">
            {o.code}
          </span>
        ) : (
          <a key={o.code} href={switchHref(from, o, here, fieldIds)} hrefLang={o.locale} lang={o.locale} title={o.name} className="rounded-full px-2 py-1 hover:bg-surface-2">
            {o.code}
          </a>
        ),
      )}
    </span>
  )
}
