import { FIELD_BY_ID } from '@/lib/taxonomy/fields.ts'
import { BASIC_KEYS } from '@/lib/taxonomy/basic-interests.ts'
import type { BasicKey } from '@/lib/taxonomy/basic-interests.ts'
import { basicLabel } from '@/lib/site/basic-labels.ts'
import { fitText } from '@/lib/site/fit-text.ts'
import type { Locale } from '@/lib/site/config.ts'

/**
 * The basic interests a field stands out on, strongest first: at most four
 * clearly above the average field, else the two highest. The same profile the
 * questionnaire matches against, so the page says what the ranking means.
 */
export function standoutInterests(fieldId: string): BasicKey[] {
  const basic = FIELD_BY_ID[fieldId].basic
  const sorted = [...BASIC_KEYS].sort((a, b) => basic[b] - basic[a])
  const clear = sorted.filter((k) => basic[k] >= 1).slice(0, 4)
  return clear.length ? clear : sorted.slice(0, 2)
}

/** «Suits you if this draws you in:» with the field's standout basic interests. */
export function FitsWhom({ fieldId, locale, className = '' }: { fieldId: string; locale: Locale; className?: string }) {
  return (
    <div className={className}>
      <p className="text-sm text-muted">{fitText(locale).whoLead}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {standoutInterests(fieldId).map((k) => (
          <li key={k} className="chip">{basicLabel(k, locale)}</li>
        ))}
      </ul>
    </div>
  )
}
