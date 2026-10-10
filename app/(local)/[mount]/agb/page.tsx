import { localMount } from '@/lib/site/local-mount.ts'
import { localMeta } from '@/lib/site/meta.ts'
import { TermsView } from '../../../views/longform.tsx'

export const generateMetadata = ({ params }: { params: Promise<{ mount: string }> }) => localMeta(params, (r) => r.terms, (t) => ({ title: t.meta.terms }))

export default async function Page({ params }: { params: Promise<{ mount: string }> }) {
  return <TermsView {...localMount((await params).mount)} />
}
