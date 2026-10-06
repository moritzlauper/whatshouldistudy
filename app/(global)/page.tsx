import { pageMeta } from '@/lib/site/meta.ts'
import { Landing } from '../views/landing.tsx'

export const revalidate = 3600

export const metadata = pageMeta('global', (r) => r.home, {})

export default function Home() {
  return <Landing site="global" base="" />
}
