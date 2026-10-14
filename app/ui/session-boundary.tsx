'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { isCounsellingPath } from '@/lib/counselling.ts'

/** The session never mounts the regular shell's tracking, organisation capture or navigation. */
export function SessionBoundary({ children, session }: { children: ReactNode; session: ReactNode }) {
  const path = usePathname()
  return isCounsellingPath(path) ? <main className="flex-1">{session}</main> : children
}
