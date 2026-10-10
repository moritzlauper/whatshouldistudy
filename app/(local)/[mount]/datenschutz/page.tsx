import { localMount } from '@/lib/site/local-mount.ts'
import { localMeta } from '@/lib/site/meta.ts'
import { PrivacyView } from '../../../views/longform.tsx'

export const generateMetadata = ({ params }: { params: Promise<{ mount: string }> }) => localMeta(params, (r) => r.privacy, (t) => ({ title: t.meta.privacy }))

export default async function Page({ params }: { params: Promise<{ mount: string }> }) {
  return <PrivacyView {...localMount((await params).mount)} />
}
