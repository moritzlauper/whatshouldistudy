import { pageMeta } from '@/lib/site/meta.ts'
import { professionalText } from '@/lib/site/professional-text.ts'
import { ProfessionalView } from '../../views/professional.tsx'

const text = professionalText('en')
export const metadata = pageMeta('global', r => r.professional, { title: text.title, description: text.notice })

export default function Page() {
  return <ProfessionalView site="global" base="" />
}
