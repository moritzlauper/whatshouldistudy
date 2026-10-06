import { localMeta } from '@/lib/site/meta.ts'
import { UnlockedView } from '../../../views/unlocked.tsx'

export const generateMetadata = ({ params }: { params: Promise<{ mount: string }> }) => localMeta(params, (r) => r.unlocked, (t) => ({ title: t.meta.unlocked, index: false }))

export default function Freigeschaltet() {
  return <UnlockedView />
}
