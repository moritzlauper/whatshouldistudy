import { FIELD_BY_ID, SUBJECT_KEYS } from '@/lib/taxonomy/fields.ts'
import { BASIC_KEYS } from '@/lib/taxonomy/basic-interests.ts'
import type { BasicKey } from '@/lib/taxonomy/basic-interests.ts'
import { basicLabel } from '@/lib/site/basic-labels.ts'
import { subjectLabel } from '@/lib/site/labels.ts'
import { fitText } from '@/lib/site/fit-text.ts'
import type { Locale } from '@/lib/site/config.ts'

/** A field's level on every activity scale and school subject, standardised across fields, with a label. */
function levels(fieldId: string, locale: Locale): Array<{ key: string; label: string; z: number }> {
  const f = FIELD_BY_ID[fieldId]
  return [
    ...BASIC_KEYS.map((k: BasicKey) => ({ key: k, label: basicLabel(k, locale), z: f.basic[k] })),
    ...SUBJECT_KEYS.map((k) => ({ key: `s:${k}`, label: subjectLabel(k, locale), z: f.subjectLevel[k] })),
  ]
}

/**
 * What a field stands out on, strongest first: at most four interests or
 * subjects clearly above the average field, else the two highest. The same
 * profile the questionnaire matches against, so the page says what the
 * ranking means.
 */
export function standoutInterests(fieldId: string, locale: Locale) {
  const sorted = levels(fieldId, locale).sort((a, b) => b.z - a.z)
  const clear = sorted.filter((x) => x.z >= 1).slice(0, 4)
  return clear.length ? clear : sorted.slice(0, 2)
}

/** What a field draws on least, weakest first: at most three, clearly below the average field. */
export function remoteInterests(fieldId: string, locale: Locale) {
  return levels(fieldId, locale).sort((a, b) => a.z - b.z).filter((x) => x.z <= -0.5).slice(0, 3)
}

/** «Suits you if this draws you in:» with the field's standout basic interests, and with `against` what speaks against it. */
export function FitsWhom({ fieldId, locale, className = '', against = false }: { fieldId: string; locale: Locale; className?: string; against?: boolean }) {
  const f = fitText(locale)
  const remote = against ? remoteInterests(fieldId, locale) : []
  return (
    <div className={className}>
      <p className="text-sm text-muted">{f.whoLead}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {standoutInterests(fieldId, locale).map((x) => (
          <li key={x.key} className="chip">{x.label}</li>
        ))}
      </ul>
      {remote.length > 0 && <>
        <p className="mt-3 text-sm text-muted">{f.whoNot}</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {remote.map((x) => (
            <li key={x.key} className="chip-soft">{x.label}</li>
          ))}
        </ul>
      </>}
    </div>
  )
}
