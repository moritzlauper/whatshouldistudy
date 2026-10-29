/** Deterministic release evidence, with no participant data or environment values. */
import { createHash } from 'node:crypto'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { instrumentDefinition } from '../lib/assessment.ts'
import { ASSESSMENT_VERSION } from '../lib/engine/assessment-version.ts'
import { FIELDS } from '../lib/taxonomy/fields.ts'
import { FIELD_ONET } from '../lib/taxonomy/field-onet.ts'
import type { Locale } from '../lib/site/config.ts'

const root = new URL('../', import.meta.url)
const sha = (text: string) => createHash('sha256').update(text).digest('hex')
const files = [
  'lib/engine/questionnaire.ts', 'lib/engine/scoring.ts', 'lib/engine/programme-fit.ts',
  'lib/engine/recency.ts', 'lib/engine/topics.ts', 'lib/engine/classifier.ts', 'lib/engine/text.ts',
  'lib/engine/accumulate.ts', 'lib/engine/music.ts', 'lib/engine/grades.ts', 'lib/taxonomy/fields.ts',
  'lib/taxonomy/field-onet.ts', 'lib/taxonomy/onet-interests.ts', 'lib/assessment.ts', 'lib/site/fit-text.ts',
  'app/ui/questionnaire-form.tsx', 'app/views/counselling.tsx', 'lib/site/assessment-text.ts',
  'lib/server/personal-fit.ts', 'lib/server/content-analysis.ts', 'lib/engine/content-analysis.ts',
  'lib/infomaniak.ts', 'lib/site/dict.ts', 'lib/site/regional.ts',
]
const languages: Locale[] = ['de-CH', 'de-DE', 'de-AT', 'en', 'fr-CH', 'it-CH']
const manifest = {
  schema: 'wsis-validation-release-v1',
  status: 'implementation-record-not-empirical-validation',
  version: ASSESSMENT_VERSION,
  sourceFiles: Object.fromEntries(files.map(file => [file, sha(readFileSync(new URL(file, root), 'utf8'))])),
  instruments: Object.fromEntries(languages.map(locale => {
    const definition = instrumentDefinition(locale)
    return [locale, { sha256: sha(JSON.stringify(definition)), definition }]
  })),
  catalogue: 'External changing dataset: archive its release and checksum separately before any study; not included here.',
  ai: 'Source checksums identify prompts and configured model. Provider model updates can still occur. No participant AI requests recorded.',
}
const review = {
  schema: 'wsis-field-review-v1',
  status: 'riasec-derived-from-onet-other-values-unreviewed',
  instructions: 'Two independent reviewers first; cite curriculum URLs, retrieval dates and relevant content. Record conflicts and disagreements. Do not infer empirical validation from completed reviews.',
  fields: FIELDS.map(f => ({
    id: f.id, name: f.name, proposed: { riasec: f.riasec, riasecOccupations: FIELD_ONET[f.id], subjects: f.subjects, values: f.values },
    curriculumEvidence: [], independentReviews: [], adjudication: null, status: 'unreviewed',
  })),
}

const outputs = { 'release-manifest.json': manifest, 'field-review-template.json': review }
mkdirSync(new URL('docs/validation/', root), { recursive: true })
for (const [file, value] of Object.entries(outputs)) {
  const path = new URL(`docs/validation/${file}`, root)
  const expected = JSON.stringify(value, null, 2) + '\n'
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== expected) throw new Error(`${file} is stale. Review the procedure change, update version IDs when needed, then run npm run validation:bundle.`)
  } else writeFileSync(path, expected)
}
console.log(process.argv.includes('--check') ? 'Validation release matches source and all six language variants.' : 'Wrote release manifest and unreviewed field template. No research data collected.')
