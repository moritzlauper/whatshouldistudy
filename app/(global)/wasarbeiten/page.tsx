import type { Metadata } from 'next'
import { dict } from '@/lib/site/dict.ts'
import { getJobs } from '@/lib/server/jobs.ts'
import { WorkView } from '../../views/work.tsx'

export const revalidate = 3600
export const metadata: Metadata = { title: dict('en').work.title, description: dict('en').work.lead, robots: { index: false } }

export default async function Work() {
  return <WorkView {...await getJobs()} />
}
