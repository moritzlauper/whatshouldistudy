import type { Metadata } from 'next'
import { ResultsClient } from './results-client.tsx'

export const metadata: Metadata = { title: 'Your result', robots: { index: false } }

export default function Results() {
  return <ResultsClient />
}
