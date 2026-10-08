import Link from 'next/link'
import type { ReactNode } from 'react'
import { linkTarget } from '@/lib/blog-check.ts'
import type { Routes } from '@/lib/site/config.ts'
import { FIELD_BY_ID } from '@/lib/taxonomy/fields.ts'

/**
 * The Markdown the blog posts are written in, and nothing more: ## and ###
 * headings, paragraphs, - and 1. lists, **bold** and [links](…). A link goes
 * to a field page (field:<id>), the questionnaire (start) or an https address.
 * `text` adapts the visible words (German for Germany and Austria), never the
 * link targets.
 */

const FIELD_IDS = new Set(Object.keys(FIELD_BY_ID))

function inline(s: string, r: Routes, text: (s: string) => string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  let i = 0
  for (const m of s.matchAll(re)) {
    if (m.index > last) out.push(text(s.slice(last, m.index)))
    const k = `${key}-${i++}`
    if (m[1] !== undefined) out.push(<strong key={k}>{text(m[1])}</strong>)
    else {
      const label = text(m[2])
      const target = linkTarget(m[3], FIELD_IDS)
      if (target?.kind === 'field') out.push(<Link key={k} href={r.field(target.id)}>{label}</Link>)
      else if (target?.kind === 'start') out.push(<Link key={k} href={r.start}>{label}</Link>)
      else if (target?.kind === 'url') out.push(<a key={k} href={m[3]} target="_blank" rel="noopener">{label}</a>)
      else out.push(label)
    }
    last = m.index + m[0].length
  }
  if (last < s.length) out.push(text(s.slice(last)))
  return out
}

export function Markdown({ source, r, text = (s) => s }: { source: string; r: Routes; text?: (s: string) => string }) {
  // A heading is a block of its own even without blank lines around it.
  const blocks = source.replace(/^(#{2,3} .*)$/gm, '\n$1\n').trim().split(/\n\s*\n/)
  return (
    <>
      {blocks.map((block, b) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
        const key = `b${b}`
        const first = lines[0] ?? ''
        if (first.startsWith('### ')) return <h3 key={key}>{inline(first.slice(4), r, text, key)}</h3>
        if (first.startsWith('## ')) return <h2 key={key}>{inline(first.slice(3), r, text, key)}</h2>
        if (lines.every((l) => l.startsWith('- ')))
          return <ul key={key}>{lines.map((l, i) => <li key={i}>{inline(l.slice(2), r, text, `${key}-${i}`)}</li>)}</ul>
        if (lines.every((l) => /^\d+\. /.test(l)))
          return <ol key={key} className="list-decimal space-y-2 pl-6">{lines.map((l, i) => <li key={i}>{inline(l.replace(/^\d+\. /, ''), r, text, `${key}-${i}`)}</li>)}</ol>
        return <p key={key}>{inline(lines.join(' '), r, text, key)}</p>
      })}
    </>
  )
}
