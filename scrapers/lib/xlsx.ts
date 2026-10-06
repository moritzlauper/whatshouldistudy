/**
 * Just enough of .xlsx to read statistics tables: every sheet as rows of cell
 * strings, by column index. No formulas, styles or dates.
 */
import { strFromU8, unzipSync } from 'fflate'

export interface Sheet {
  name: string
  rows: string[][]
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')

function colIndex(ref: string): number {
  let n = 0
  for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export function readXlsx(data: Uint8Array): Sheet[] {
  const files = unzipSync(data)
  const text = (name: string) => (files[name] ? strFromU8(files[name]) : '')
  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')),
  )
  // Sheet names in workbook order, mapped to their files through the relationships.
  const rels = new Map([...text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2]]))
  const sheets: Sheet[] = []
  for (const m of text('xl/workbook.xml').matchAll(/<sheet [^>]*name="([^"]*)"[^>]*r:id="([^"]+)"/g)) {
    const target = rels.get(m[2])
    if (!target) continue
    const xml = text(target.startsWith('/') ? target.slice(1) : `xl/${target}`)
    const rows: string[][] = []
    for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = []
      for (const c of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const body = c[3] ?? ''
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
        const inline = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1]
        cells[colIndex(c[1])] = /t="s"/.test(c[2]) ? (shared[Number(v)] ?? '') : decode(v ?? inline ?? '')
      }
      // Statistics offices like non-breaking spaces; make them plain.
      rows.push(Array.from(cells, (x) => (x ?? '').replace(/\s+/g, ' ').trim()))
    }
    sheets.push({ name: decode(m[1]), rows })
  }
  return sheets
}
