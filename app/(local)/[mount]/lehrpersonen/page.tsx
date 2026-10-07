import { mountInfo } from '@/lib/site/kit.ts'
import { localMeta } from '@/lib/site/meta.ts'
import { teachersText } from '@/lib/site/teachers-text.ts'
import { TeachersView } from '../../../views/teachers.tsx'

export const revalidate = 3600

export const generateMetadata = async ({ params }: { params: Promise<{ mount: string }> }) => {
  const { locale } = mountInfo((await params).mount)
  const t = teachersText(locale)
  return localMeta(params, (r) => r.teachers, () => ({ title: t.metaTitle, description: t.metaDesc }))
}

export default async function Page({ params }: { params: Promise<{ mount: string }> }) {
  return <TeachersView {...mountInfo((await params).mount)} />
}
