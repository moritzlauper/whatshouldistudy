import { BIG5_KEYS, FIELD_BY_ID, RIASEC_KEYS, SUBJECT_KEYS, VALUE_KEYS } from '@/lib/taxonomy/fields.ts'
import { BASIC_KEYS } from '@/lib/taxonomy/basic-interests.ts'
import type { BasicKey } from '@/lib/taxonomy/basic-interests.ts'
import { basicLabel } from '@/lib/site/basic-labels.ts'
import { big5Label, riasecLabel, subjectLabel, valueLabel } from '@/lib/site/labels.ts'
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
 * subjects clearly above the average field (z ≥ 0.75), else the two highest. The same
 * profile the questionnaire matches against, so the page says what the
 * ranking means.
 */
export function standoutInterests(fieldId: string, locale: Locale) {
  const sorted = levels(fieldId, locale).sort((a, b) => b.z - a.z)
  const clear = sorted.filter((x) => x.z >= 0.75).slice(0, 4)
  return clear.length ? clear : sorted.slice(0, 2)
}

/** What a field draws on least, weakest first: at most three, clearly below the average field. */
export function remoteInterests(fieldId: string, locale: Locale) {
  return levels(fieldId, locale).sort((a, b) => a.z - b.z).filter((x) => x.z <= -0.5).slice(0, 3)
}

/** Holland types the field is built on: at most three, close to its peak. */
export function fieldTypes(fieldId: string) {
  const r = FIELD_BY_ID[fieldId].riasec
  const peak = Math.max(...r)
  return RIASEC_KEYS.map((k, i) => ({ k, v: r[i] })).filter((x) => x.v >= Math.max(0.6, peak - 0.2)).sort((a, b) => b.v - a.v).slice(0, 3)
}

/** Holland types the field hardly needs: at most two, well below its peak. */
export function remoteTypes(fieldId: string) {
  const r = FIELD_BY_ID[fieldId].riasec
  const peak = Math.max(...r)
  return RIASEC_KEYS.map((k, i) => ({ k, v: r[i] })).filter((x) => x.v <= 0.3 && x.v <= peak - 0.4).sort((a, b) => a.v - b.v).slice(0, 2)
}

/** Personality traits typical for the field, strongest first. */
export function fieldTraits(fieldId: string) {
  const b = FIELD_BY_ID[fieldId].big5
  return BIG5_KEYS.map((k) => ({ k, v: b[k] ?? 0 })).filter((x) => Math.abs(x.v) >= 0.15).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 3)
}

/** What jobs after the field typically offer: at most three values. */
export function fieldValues(fieldId: string) {
  const v = FIELD_BY_ID[fieldId].values
  return VALUE_KEYS.filter((k) => v[k] >= 0.6).sort((a, b) => v[b] - v[a]).slice(0, 3)
}

/** «Denker:in: analysieren, …» → «analysieren, …»: the description without its role name. */
const typeDescription = (short: string) => short.split(/\s?:\s/).pop()!

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-2">{children}</dd>
    </div>
  )
}

/**
 * «Suits you if this draws you in:» with the field's standout basic interests, and with `against` what speaks against it.
 * `detailed` shows the whole profile the matching uses: Holland types, interests and subjects, personality and values.
 */
export function FitsWhom({ fieldId, locale, className = '', against = false, detailed = false }: { fieldId: string; locale: Locale; className?: string; against?: boolean; detailed?: boolean }) {
  const f = fitText(locale)
  const remote = against ? remoteInterests(fieldId, locale) : []
  if (detailed) {
    const types = fieldTypes(fieldId)
    const traits = fieldTraits(fieldId)
    const values = fieldValues(fieldId)
    const lows = [...remoteTypes(fieldId).map((x) => ({ key: `r:${x.k}`, label: riasecLabel(x.k, locale).name })), ...remote]
    return (
      <div className={className}>
        <dl className="grid gap-5">
          {types.length > 0 && (
            <Row label={f.fitType}>
              <ul className="grid gap-2">
                {types.map((x) => (
                  <li key={x.k}>
                    <span className="chip">{riasecLabel(x.k, locale).name}</span>{' '}
                    <span className="text-sm text-muted">{typeDescription(riasecLabel(x.k, locale).short)}</span>
                  </li>
                ))}
              </ul>
            </Row>
          )}
          <Row label={f.fitInterests}>
            <ul className="flex flex-wrap gap-2">
              {standoutInterests(fieldId, locale).map((x) => <li key={x.key} className="chip">{x.label}</li>)}
            </ul>
          </Row>
          {traits.length > 0 && (
            <Row label={f.fitPersonality}>
              <ul className="flex flex-wrap gap-2">
                {traits.map((x) => <li key={x.k} className="chip">{x.v > 0 ? big5Label(x.k, locale).high : big5Label(x.k, locale).low}</li>)}
              </ul>
            </Row>
          )}
          {values.length > 0 && (
            <Row label={f.fitValues}>
              <ul className="flex flex-wrap gap-2">
                {values.map((k) => <li key={k} className="chip">{valueLabel(k, locale)}</li>)}
              </ul>
            </Row>
          )}
          {lows.length > 0 && (
            <Row label={f.fitAgainst}>
              <ul className="flex flex-wrap gap-2">
                {lows.map((x) => <li key={x.key} className="chip-soft">{x.label}</li>)}
              </ul>
            </Row>
          )}
        </dl>
        <p className="mt-4 text-xs text-muted">{f.fitNote}</p>
      </div>
    )
  }
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
