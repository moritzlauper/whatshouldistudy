import { pageMeta } from '@/lib/site/meta.ts'
import { instrumentText } from '@/lib/site/assessment-text.ts'
import { CounsellingView } from '../../views/counselling.tsx'

const text = instrumentText('en')
export const metadata = pageMeta('global', r => r.counselling, { title: text.title, description: text.lead })
export default function Page() { return <CounsellingView /> }
