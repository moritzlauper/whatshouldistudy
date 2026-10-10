import { notFound } from 'next/navigation'
import { ALL_MOUNTS, mountInfo } from './kit.ts'

/**
 * mountInfo for the pages of the country sites, with a 404 for a path that is
 * no country site (/foo/…). The layout can't keep those out with
 * dynamicParams = false, since that would also hold for the programme pages,
 * which are built on request. Kept apart from kit.ts, which the tests load in
 * plain Node, where next/navigation doesn't resolve.
 */
export function localMount(mount: string): ReturnType<typeof mountInfo> {
  if (!ALL_MOUNTS.includes(mount)) notFound()
  return mountInfo(mount)
}
