import { mountInfo } from '@/lib/site/kit.ts'
import { localMeta } from '@/lib/site/meta.ts'
import { ImprintView } from '../../../views/longform.tsx'

export const generateMetadata = ({ params }: { params: Promise<{ mount: string }> }) => localMeta(params, (r) => r.imprint, (t) => ({ title: t.meta.imprint }))

export default async function Page({ params }: { params: Promise<{ mount: string }> }) {
  return <ImprintView {...mountInfo((await params).mount)} />
}
