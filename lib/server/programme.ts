import 'server-only'
import { hasProgrammePages, idFromSlug, programmeSlug } from '../catalogue.ts'
import { FIELD_BY_ID } from '../taxonomy/fields.ts'
import { getCatalogue, getShard } from './data.ts'
import type { CatalogueEntry, Programme, ProgrammeShard } from '../programmes.ts'

/** Programmes of a field shard by id, built once per loaded shard. */
const byId = new WeakMap<object, Map<string, Programme>>()

function index(shard: ProgrammeShard): Map<string, Programme> {
  let m = byId.get(shard)
  if (!m) {
    m = new Map(shard.programmes.map((p) => [p.id, p]))
    byId.set(shard, m)
  }
  return m
}

export interface FoundProgramme {
  /** The full record; only its catalogue fields and its source may reach a page. */
  p: Programme
  shard: ProgrammeShard
}

/** A programme of a country in the shard of one of its fields, or null. */
export async function findProgramme(cc: string, field: string, id: string): Promise<FoundProgramme | null> {
  const shard = await getShard(field)
  const p = shard && index(shard).get(id)
  return shard && p && p.country === cc ? { p, shard } : null
}

/** Where a programme lives now, when it was asked for under a field it no longer has. */
export async function findInCatalogue(cc: string, id: string): Promise<CatalogueEntry | null> {
  const catalogue = await getCatalogue(cc)
  return catalogue?.programmes.find((p) => p.id === id) ?? null
}

type Resolved = { found: FoundProgramme } | { redirect: { field: string; slug: string } } | { gone: string } | null

/**
 * A programme whose id changed between data runs (its source or link moved),
 * found again by the name and institution in its old address.
 */
async function findByName(cc: string, field: string, slug: string): Promise<CatalogueEntry | null> {
  const catalogue = await getCatalogue(cc)
  const text = slug.replace(/-[a-z0-9]{6,16}$/, '')
  if (!catalogue || !text) return null
  const same = catalogue.programmes.filter((p) => programmeSlug(p).replace(/-[a-z0-9]{6,16}$/, '') === text)
  return same.find((p) => p.fields.includes(field)) ?? (same.length === 1 ? same[0] : null)
}

/**
 * The programme behind an address. Only the id counts: under another field or
 * an outdated slug the answer is the programme's own address, so every
 * programme has exactly one.
 */
export async function resolveProgramme(cc: string, field: string, slug: string): Promise<Resolved> {
  const id = idFromSlug(slug)
  if (!id || !hasProgrammePages(cc) || !FIELD_BY_ID[field]) return null
  const found = await findProgramme(cc, field, id)
  const target = found ? found.p : ((await findInCatalogue(cc, id)) ?? (await findByName(cc, field, slug)))
  // An old link to a programme that is no longer listed leads to its field's list, not to an error.
  if (!target) return { gone: field }
  const own = { field: target.fields[0], slug: programmeSlug(target) }
  if (found && own.field === field && own.slug === slug) return { found }
  // A catalogue that disagrees with the field files must not send the page in a circle.
  if (own.field === field && own.slug === slug) return null
  return { redirect: own }
}
