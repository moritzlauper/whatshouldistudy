import { createHash } from 'node:crypto'
import nodemailer from 'nodemailer'
import { NextResponse } from 'next/server'
import { CONTACT, hostsFor, SITE_URL } from '@/lib/site.ts'
import { LOCAL_SITES, SITES } from '@/lib/site/config.ts'
import { redis } from '@/lib/server/usage.ts'

export const maxDuration = 20

const RATE_LIMIT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], 3600) end
return count
`

const COPY = {
  en: { subject: 'Your study-choice result', body: 'Here is your result. The complete result is contained in this link and is not stored on our servers:' },
  de: { subject: 'Dein Resultat zur Studienwahl', body: 'Hier ist dein Resultat. Der vollständige Inhalt steckt in diesem Link und wird nicht auf unseren Servern gespeichert:' },
  fr: { subject: 'Ton résultat sur le choix des études', body: 'Voici ton résultat. Il est entièrement contenu dans ce lien et n’est pas enregistré sur nos serveurs :' },
  it: { subject: 'Il tuo risultato sulla scelta degli studi', body: 'Ecco il tuo risultato. Il contenuto completo è incluso in questo link e non viene salvato sui nostri server:' },
} as const

type Lang = keyof typeof COPY

function allowedOrigins(): Set<string> {
  const origins = [SITE_URL, ...Object.values(SITES).map((site) => site.domainUrl), ...LOCAL_SITES.flatMap((site) => hostsFor(site).map((host) => `https://${host}`))]
  return new Set(origins.filter(Boolean).flatMap((origin) => {
    try {
      return [new URL(origin).origin]
    } catch {
      return []
    }
  }))
}

export async function POST(req: Request) {
  if (!req.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 415 })
  }
  const length = Number(req.headers.get('content-length') ?? 0)
  if (length > 40_000) return NextResponse.json({ error: 'Invalid request.' }, { status: 413 })

  const reader = req.body?.getReader()
  if (!reader) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 40_000) {
        await reader.cancel()
        return NextResponse.json({ error: 'Invalid request.' }, { status: 413 })
      }
      chunks.push(value)
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  let input: { email?: unknown; url?: unknown; lang?: unknown }
  try {
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const email = typeof input.email === 'string' ? input.email.trim() : ''
  const lang: Lang = input.lang === 'de' || input.lang === 'fr' || input.lang === 'it' ? input.lang : 'en'
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  let url: URL
  try {
    if (typeof input.url !== 'string' || input.url.length > 30_000) throw new Error('invalid')
    url = new URL(input.url)
    if (url.protocol !== 'https:' || !allowedOrigins().has(url.origin) || !/^#s=[A-Za-z0-9_-]+$/.test(url.hash)) throw new Error('invalid')
  } catch {
    return NextResponse.json({ error: 'The result link is invalid. Reload the page and try again.' }, { status: 400 })
  }

  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rateKey = `wsis:share-email:v1:${createHash('sha256').update(ip).digest('hex')}`
  try {
    const count = Number(await redis(['EVAL', RATE_LIMIT, 1, rateKey]))
    if (count > 5) return NextResponse.json({ error: 'Too many emails from this connection. Try again later.' }, { status: 429 })
  } catch {
    return NextResponse.json({ error: 'Email is temporarily unavailable. Try again later.' }, { status: 503 })
  }

  const user = process.env.SMTP_USER || process.env.NEXT_PUBLIC_CONTACT_EMAIL || CONTACT || 'team@whatshouldistudy.com'
  const password = process.env.SMTP_PASSWORD
  if (!password || !user) return NextResponse.json({ error: 'Email is not configured.' }, { status: 503 })

  const port = Number(process.env.SMTP_PORT || 465)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.infomaniak.com',
    port,
    secure: port === 465,
    auth: { user, pass: password },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  })

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || user,
      to: email,
      subject: COPY[lang].subject,
      text: `${COPY[lang].body}\n\n${url.toString()}`,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const mailError = error as Error & { code?: string; command?: string; responseCode?: number }
    console.error('Share email SMTP delivery failed', {
      code: mailError.code ?? 'UNKNOWN',
      command: mailError.command,
      responseCode: mailError.responseCode,
    })
    return NextResponse.json({ error: 'The email could not be sent. Try again later.' }, { status: 502 })
  } finally {
    transporter.close()
  }
}