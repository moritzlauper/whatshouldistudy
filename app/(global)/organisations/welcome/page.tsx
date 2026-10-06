import type { Metadata } from 'next'
import { orgsText } from '@/lib/site/orgs-text.ts'
import { OrgWelcomeView } from '../../../views/org-welcome.tsx'

export const metadata: Metadata = { title: orgsText('en').welcome.adminLink, robots: { index: false } }

export default function OrgWelcome() {
  return <OrgWelcomeView />
}
