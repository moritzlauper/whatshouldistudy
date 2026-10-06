import { localMeta } from '@/lib/site/meta.ts'
import { OrgWelcomeView } from '../../../../views/org-welcome.tsx'

export const generateMetadata = ({ params }: { params: Promise<{ mount: string }> }) => localMeta(params, (r) => r.orgWelcome, () => ({ title: 'Übersicht', index: false }))

export default function Page() {
  return <OrgWelcomeView />
}
