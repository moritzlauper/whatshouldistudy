'use client'

import { useEffect } from 'react'
import { update } from '@/lib/store.ts'

/** Remembers the school link a student arrived through (…?org=…), so the paywall can offer to unlock through it. */
export function OrgCapture() {
  useEffect(() => {
    const org = new URLSearchParams(window.location.search).get('org')
    if (org && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(org)) update((s) => (s.org === org ? s : { ...s, org }))
  }, [])
  return null
}
