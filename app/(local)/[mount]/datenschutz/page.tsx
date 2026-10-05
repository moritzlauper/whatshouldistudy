import { mountInfo } from '@/lib/site/kit.ts'
import { localMeta } from '@/lib/site/meta.ts'
import { PrivacyView } from '../../../views/longform.tsx'

export const generateMetadata = ({ params }: { params: Promise<{ mount: string }> }) => localMeta(params, '/datenschutz', (t) => ({ title: t.meta.privacy }))

export default async function Page({ params }: { params: Promise<{ mount: string }> }) {
  return <PrivacyView {...mountInfo((await params).mount)} />
}
