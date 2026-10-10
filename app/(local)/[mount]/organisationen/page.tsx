import { localMount } from '@/lib/site/local-mount.ts'
import { localMeta } from '@/lib/site/meta.ts'
import { orgsText } from '@/lib/site/orgs-text.ts'
import { OrgsView } from '../../../views/orgs.tsx'

export const revalidate = 3600

export const generateMetadata = async ({ params }: { params: Promise<{ mount: string }> }) => {
  const { site, locale } = localMount((await params).mount)
  const o = orgsText(locale)
  return localMeta(params, (r) => r.orgs, () => ({ title: o.title, description: o.metaDesc(site === 'ch' ? '1’000' : '1.000') }))
}

export default async function Page({ params }: { params: Promise<{ mount: string }> }) {
  return <OrgsView {...localMount((await params).mount)} />
}
