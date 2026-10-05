import { FIELDS } from '@/lib/taxonomy/fields.ts'
import { mountInfo } from '@/lib/site/kit.ts'
import { localMeta } from '@/lib/site/meta.ts'
import { FieldsView } from '../../../views/fields.tsx'

export const revalidate = 86400

export const generateMetadata = ({ params }: { params: Promise<{ mount: string }> }) => localMeta(params, '/faecher', (t) => ({ title: t.meta.fields, description: t.meta.fieldsDesc(FIELDS.length) }))

export default async function Faecher({ params }: { params: Promise<{ mount: string }> }) {
  return <FieldsView {...mountInfo((await params).mount)} />
}
