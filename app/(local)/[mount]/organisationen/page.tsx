import { mountInfo } from '@/lib/site/kit.ts'
import { localMeta } from '@/lib/site/meta.ts'
import { orgsText } from '@/lib/site/orgs-text.ts'
import { SITES } from '@/lib/site/config.ts'
import { OrgsView } from '../../../views/orgs.tsx'

export const revalidate = 3600

export const generateMetadata = async ({ params }: { params: Promise<{ mount: string }> }) => {
  const { site } = mountInfo((await params).mount)
  const o = orgsText(SITES[site].locale)
  return localMeta(params, '/organisationen', () => ({ title: o.title, description: o.metaDesc(site === 'ch' ? '1’000' : '1.000') }))
}

export default async function Page({ params }: { params: Promise<{ mount: string }> }) {
  return <OrgsView {...mountInfo((await params).mount)} />
}
