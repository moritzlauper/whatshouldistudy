import type { Insight, Reason } from '../engine/types.ts'
import type { Kit } from './kit.ts'
import { big5Label, fmtNumber, riasecLabel, subjectLabel, valueLabel } from './labels.ts'

/** A reason from the scoring as a sentence in the site's language. */
export function reasonText(r: Reason, k: Pick<Kit, 't' | 'locale'>): string {
  const { t, locale } = k
  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')}${t.reasons.and}${xs.at(-1)}` : (xs[0] ?? ''))
  const lower = (s: string) => (locale === 'en' ? s.toLowerCase() : s)
  switch (r.k) {
    case 'interest':
      return t.reasons.interest(r.items, r.months)
    case 'riasec':
      return t.reasons.riasec(list(r.types.map((x) => riasecLabel(x, locale).name)))
    case 'subjects':
      return t.reasons.subjects(list(r.subjects.map((x) => subjectLabel(x, locale))))
    case 'subjectsLow':
      return t.reasons.subjectsLow(list(r.subjects.map((x) => subjectLabel(x, locale))))
    case 'values':
      return t.reasons.values(list(r.values.map((x) => lower(valueLabel(x, locale)))))
    case 'personality':
      return t.reasons.personality(r.high, locale === 'en' ? big5Label(r.trait, locale).name.toLowerCase() : big5Label(r.trait, locale).name)
    case 'hidden':
      return t.reasons.hidden
  }
}

/** Title, headline value and explanation of an insight card. */
export function insightText(ins: Insight, k: Pick<Kit, 't' | 'intl'>): { title: string; value: string; detail: string } {
  const { t, intl } = k
  const d = ins.data
  const n = (key: string) => Number(d[key] ?? 0)
  const s = (key: string) => String(d[key] ?? '')
  switch (ins.id) {
    case 'datapoints':
      return { title: t.insights.datapoints.title, value: fmtNumber(n('points'), intl), detail: t.insights.datapoints.detail(n('sources')) }
    case 'learning':
      return { title: t.insights.learning.title, value: `${n('share')} %`.replace(' %', intl.startsWith('de') ? ' %' : '%'), detail: t.insights.learning.detail(n('share')) }
    case 'breadth':
      return { title: t.insights.breadth.title, value: t.insights.breadth.value[s('style')] ?? s('style'), detail: t.insights.breadth.detail(s('style'), n('areas'), d.spread === true) }
    case 'consistency':
      return { title: t.insights.consistency.title, value: t.insights.consistency.value[s('level')] ?? s('level'), detail: t.insights.consistency.detail[s('level')] ?? '' }
    case 'rhythm':
      return { title: t.insights.rhythm.title, value: t.insights.rhythm.value[s('type')] ?? s('type'), detail: t.insights.rhythm.detail(n('peak'), n('night')) }
    case 'maker':
      return { title: t.insights.maker.title, value: t.insights.maker.value(n('count')), detail: t.insights.maker.detail(n('count')) }
  }
}
