import Link from 'next/link'
import type { Locale } from '@/lib/site/config.ts'
import { professionalText } from '@/lib/site/professional-text.ts'

export function ProfessionalNotice({ locale, href, institution = false }: { locale: Locale; href: string; institution?: boolean }) {
  const text = professionalText(locale)
  return <aside className="mt-5 rounded-xl border-2 border-soft-line bg-surface p-4 text-sm leading-relaxed">
    <p>{text.notice}</p>
    {institution && <p className="mt-2">{text.institution}</p>}
    <Link href={href} className="mt-2 inline-block font-semibold text-accent underline">{text.link} →</Link>
  </aside>
}
