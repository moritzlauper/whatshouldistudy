import { localMount } from '@/lib/site/local-mount.ts'
import { pageMeta } from '@/lib/site/meta.ts'
import { instrumentText } from '@/lib/site/assessment-text.ts'
import { CounsellingView } from '../../../views/counselling.tsx'

export async function generateMetadata({ params }: { params: Promise<{ mount: string }> }) {
  const { site, locale } = localMount((await params).mount)
  const text = instrumentText(locale)
  return pageMeta(site, r => r.counselling, { title: text.title, description: text.lead }, locale)
}

export default function Page() { return <CounsellingView /> }
