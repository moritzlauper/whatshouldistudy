import type { Metadata } from 'next'
import { dict } from '@/lib/site/dict.ts'
import { ResultsView } from '../../views/results.tsx'

export const metadata: Metadata = { title: dict('en').meta.results, robots: { index: false } }

export default function Results() {
  return <ResultsView />
}
