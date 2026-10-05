import type { Metadata } from 'next'
import { dict } from '@/lib/site/dict.ts'
import { ResultsView } from '../../../views/results.tsx'

export const metadata: Metadata = { title: dict('de').meta.results, robots: { index: false } }

export default function Resultat() {
  return <ResultsView />
}
