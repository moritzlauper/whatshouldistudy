import { localMeta } from '@/lib/site/meta.ts'
import { getJobs } from '@/lib/server/jobs.ts'
import { WorkView } from '../../../views/work.tsx'

export const revalidate = 3600
export const generateMetadata = ({ params }: { params: Promise<{ mount: string }> }) => localMeta(params, (r) => r.work, (t) => ({ title: t.work.title, description: t.work.lead, index: false }))

export default async function Wasarbeiten() {
  return <WorkView {...await getJobs()} />
}
