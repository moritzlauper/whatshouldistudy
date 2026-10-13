'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function StartLink({ start, home, startLabel, backLabel }: { start: string; home: string; startLabel: string; backLabel: string }) {
  const routed = usePathname()
  const [path, setPath] = useState<string | null>(null)

  // Country domains are rewritten internally; compare the browser's public URL
  // after mount so the server and first client render remain identical.
  useEffect(() => {
    setPath(window.location.pathname.replace(/(.)\/$/, '$1'))
  }, [routed])

  const onStart = path === start
  return (
    <Link href={onStart ? home : start} className="btn btn-primary btn-sm ml-1">
      {onStart && <span aria-hidden="true">←</span>}
      {onStart ? backLabel : startLabel}
    </Link>
  )
}
