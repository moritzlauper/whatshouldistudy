import { localMeta } from '@/lib/site/meta.ts'
import { ResultsView } from '../../../views/results.tsx'

export const generateMetadata = ({ params }: { params: Promise<{ mount: string }> }) => localMeta(params, '/resultat', (t) => ({ title: t.meta.results, index: false }))

export default function Resultat() {
  return <ResultsView />
}
