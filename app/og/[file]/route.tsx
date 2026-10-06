import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { SITE_URL } from '@/lib/site.ts'
import { SITES } from '@/lib/site/config.ts'
import type { SiteId } from '@/lib/site/config.ts'
import { dict } from '@/lib/site/dict.ts'

/**
 * The share image of each site (1200×630), rendered once at build time:
 * /og/global.png, /og/ch.png and so on. The extension keeps proxy.ts from
 * rewriting it on a country domain.
 */
export const dynamic = 'force-static'
export const dynamicParams = false

const IDS = Object.keys(SITES) as SiteId[]

export function generateStaticParams() {
  return IDS.map((id) => ({ file: `${id}.png` }))
}

const INK = '#1a1033'
const VIOLET = '#6c3bff'

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const id = (await params).file.replace(/\.png$/, '') as SiteId
  const c = SITES[id]
  const t = dict(c.locale)
  const [font, icon] = await Promise.all([readFile(join(process.cwd(), 'app/fonts/bricolage-800.ttf')), readFile(join(process.cwd(), 'public/icon.svg'))])
  const host = new URL(c.domainUrl || SITE_URL).host
  const [a, b] = c.wordmark

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', background: '#fff6e9', color: INK, fontFamily: 'Bricolage', border: `14px solid ${INK}` }}>
        <div style={{ position: 'absolute', right: -70, top: -70, width: 300, height: 300, borderRadius: 300, background: '#ffd338', border: `6px solid ${INK}` }} />
        <div style={{ position: 'absolute', right: 230, top: 160, width: 64, height: 64, borderRadius: 64, background: '#ff5ca8', border: `5px solid ${INK}` }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <img src={`data:image/svg+xml;base64,${icon.toString('base64')}`} width={96} height={96} alt="" />
          <div style={{ display: 'flex', fontSize: 56 }}>
            <span>{a}</span>
            <span style={{ color: VIOLET }}>{b}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 940 }}>
          <div style={{ fontSize: 100, lineHeight: 1, color: VIOLET, letterSpacing: -3 }}>{t.landing.h1a}</div>
          <div style={{ marginTop: 24, fontSize: 44, lineHeight: 1.15 }}>{`${t.landing.h1b} ${t.landing.h1c} ${t.landing.h1d}`}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', padding: '12px 28px', borderRadius: 40, background: '#c6f25e', border: `5px solid ${INK}`, fontSize: 28, whiteSpace: 'nowrap' }}>{t.landing.badge}</div>
          <div style={{ display: 'flex', fontSize: 32 }}>{host}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: [{ name: 'Bricolage', data: font, weight: 800, style: 'normal' }] },
  )
}
