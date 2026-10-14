import { withBase } from '@/lib/site.ts'
import { instrumentText } from '@/lib/site/assessment-text.ts'
import type { Locale } from '@/lib/site/config.ts'

/** Full document navigation also unloads any previously loaded analytics scripts. */
export function CounsellingEntry({ locale, href }: { locale: Locale; href: string }) {
  const text = instrumentText(locale)
  return <div className="card-sm mt-6 bg-surface p-5 print:hidden">
    <p className="font-semibold">{text.title}</p>
    <p className="mt-2 text-sm text-muted">{text.lead}</p>
    <a href={withBase(href)} className="btn btn-ghost mt-4">{text.enter} →</a>
  </div>
}
