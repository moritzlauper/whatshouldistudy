import type { Entry } from '../../lib/work/types.ts'

export function cleanJobText(html: string): string {
  const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }
  return html.replace(/<[^>]*>/g, ' ').replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (all, code: string) => {
    if (!code.startsWith('#')) return named[code.toLowerCase()] ?? all
    const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ''
  }).replace(/\s+/g, ' ').trim()
}

export function entryFromTitle(title: string): Entry {
  if (/\b(?:intern|internship|trainee|apprenti|apprentie|apprentissage|apprentice|apprendista|lehrstelle|lehrling|lernende[rmn]?|ausbildung|(?:hochschul)?praktik\w*|stagiaire|stage)\b/i.test(title)) return 'training'
  if (/\b(?:senior|lead|head|director|chief|oberarzt|oberärztin|leitend\w*)\b/i.test(title)) return 'experienced'
  if (/\b(?:junior|graduate|berufseinstieg)\b/i.test(title)) return 'junior'
  return 'unknown'
}


export const swissCountry = (value: string) => /^(?:CH|Switzerland|Schweiz|Suisse|Svizzera)$/i.test(value.trim())
export const concreteJob = (title: string) => !/spontan|unsolicited|talent pool|initiativbewerbung/i.test(title)
