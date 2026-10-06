import { localMeta } from '@/lib/site/meta.ts'
import { StartView } from '../../../views/start.tsx'

export const generateMetadata = ({ params }: { params: Promise<{ mount: string }> }) => localMeta(params, (r) => r.start, (t) => ({ title: t.meta.start, description: t.meta.startDesc }))

export default function Start() {
  return <StartView />
}
