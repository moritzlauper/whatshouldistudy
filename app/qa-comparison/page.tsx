'use client'
import '../globals.css'
import { useEffect, useState } from 'react'
import { SiteProvider } from '../ui/site-context.tsx'
import { TopProgrammes, Programmes } from '../ui/programmes.tsx'
import { score } from '../../lib/engine/scoring.ts'
import { SITES } from '../../lib/site/config.ts'

const profile = score({ summaries: [], answers: {} })
const results = { ...profile, riasec: { ...profile.riasec, profile: [0, 1, 0, 1, 0, 0] as [number, number, number, number, number, number] }, fields: [
  { ...profile.fields[0], id: 'sociology', score: 88 },
  { ...profile.fields[0], id: 'psychology', score: 76 },
  { ...profile.fields[0], id: 'political-science', score: 64 },
] }
const items = [
  { id: 'politics', name: 'Master Religion – Wirtschaft – Politik', match: 52, fields: ['political-science'], matchedField: 'sociology', city: 'Zürich' },
  { id: 'education', name: 'Master Fachwissenschaft Pädagogik und Psychologie', match: 66, fields: ['psychology'], matchedField: 'psychology', city: 'Zürich' },
  { id: 'applied', name: 'Master Angewandte Psychologie', match: 60, fields: ['psychology'], matchedField: 'psychology', city: 'Zürich' },
  { id: 'bern', name: 'Master Soziologie', match: 88, fields: ['sociology'], matchedField: 'sociology', city: 'Bern' },
].map(p => ({ ...p, institution: 'Synthetische Testhochschule', country: 'CH', level: 'master', fieldConfidence: 1, isNew: false, languages: ['de'], institutionType: 'uni' }))
const facts = items.map((p, i) => ({ id: p.id, riasec: [0, i + 1, 0, i + 1, 0, 0], subjects: ['hist'], topics: p.fields, enough: true, check: 'Zulassung auf der offiziellen Seite prüfen.' }))
const prefs = { ...SITES.ch.defaultPrefs, level: 'master' as const }
let calls = 0
const explanation = 'Dein Thema passt zur Medienkommunikation. ' + 'Gesellschaft, Ökonomie und Politik werden im Studiengang gemeinsam untersucht. '.repeat(5) + 'Die Bewerbung verlangt eine wissenschaftliche Arbeitsprobe.'
function Counter() {
  const [count, setCount] = useState(0)
  useEffect(() => { const timer = setInterval(() => setCount(calls), 100); return () => clearInterval(timer) }, [])
  return <p>KI-Anfragen: {count}</p>
}
export default function QA() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const original = window.fetch
    window.fetch = async (url, init) => {
      const path = String(url)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (path.includes('/api/config')) return Response.json({ payments: 'off', consent: 'opt-in', price: { amount: 9, currency: 'CHF' } })
      if (path.includes('/api/facts')) return Response.json({ items: facts, updated: '2026-10-12' })
      if (path.includes('/api/teaser')) return Response.json({ total: 4, facets: { countries: { CH: 4 }, levels: { master: 4 }, fields: {} }, samples: [] })
      if (path.includes('/api/programmes')) {
        const found = items.filter(p => !body.city || p.city.toLowerCase().includes(body.city.toLowerCase()))
        return Response.json({ total: found.length, page: 0, pageSize: 2000, items: found, facets: { countries: { CH: found.length }, levels: { master: found.length }, fields: {} }, sample: false })
      }
      if (path.includes('/api/personal-fit')) {
        calls++
        return Response.json({ fits: body.programmes.map((p: { id: string }) => ({ id: p.id, score: 85, fit: 5, thin: false, reasons: [explanation] })) })
      }
      return original(url, init)
    }
    setReady(true)
    return () => { window.fetch = original }
  }, [])
  return <SiteProvider site="ch" base="" locale="de-CH"><main className="mx-auto max-w-3xl px-4 py-8"><h1>Synthetische UI-Prüfung</h1><Counter />{ready && <><TopProgrammes results={results} prefs={prefs} token={null} unlocked /><Programmes results={results} prefs={prefs} /></>}</main></SiteProvider>
}
