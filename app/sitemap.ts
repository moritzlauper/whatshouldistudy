import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site.ts'
import { FIELDS } from '@/lib/taxonomy/fields.ts'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${SITE_URL}/`, lastModified: now, priority: 1 },
    { url: `${SITE_URL}/start`, lastModified: now, priority: 0.9 },
    { url: `${SITE_URL}/how-it-works`, lastModified: now, priority: 0.7 },
    { url: `${SITE_URL}/fields`, lastModified: now, priority: 0.8 },
    ...FIELDS.map((f) => ({ url: `${SITE_URL}/fields/${f.id}`, lastModified: now, priority: 0.6 })),
    { url: `${SITE_URL}/privacy`, lastModified: now, priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified: now, priority: 0.2 },
  ]
}
