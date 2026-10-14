import { localMount } from '@/lib/site/local-mount.ts'
import { pageMeta } from '@/lib/site/meta.ts'
import { professionalText } from '@/lib/site/professional-text.ts'
import { ProfessionalView } from '../../../views/professional.tsx'

export async function generateMetadata({ params }: { params: Promise<{ mount: string }> }) {
  const { site, locale } = localMount((await params).mount)
  const text = professionalText(locale)
  return pageMeta(site, r => r.professional, { title: text.title, description: text.notice }, locale)
}

export default async function Page({ params }: { params: Promise<{ mount: string }> }) {
  return <ProfessionalView {...localMount((await params).mount)} />
}
