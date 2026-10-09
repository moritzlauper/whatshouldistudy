import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existingOutreach, formatOutreachGreeting, outreachCallToAction, outreachHtmlBody, outreachSite, outreachWebsiteUrls, isSwissGermanOutreach } from '../lib/outreach.ts'
import { OUTREACH_SEND_LOCK, OutreachSendBusy, outreachDailySendLimit, outreachDay, sendOutreach } from '../lib/outreach-send.ts'
import type { ImapFlow } from 'imapflow'

test('outreach send limit defaults to ten, can be lowered or disabled, and fails closed', () => {
  assert.equal(outreachDailySendLimit('10'), 10)
  assert.equal(outreachDailySendLimit('3'), 3)
  assert.equal(outreachDailySendLimit('0'), 0)
  for (const value of ['11', '-1', '1.5', '', 'abc']) assert.throws(() => outreachDailySendLimit(value))
})

test('outreach days follow Zurich midnight including daylight saving', () => {
  assert.equal(outreachDay(new Date('2026-01-01T23:00:00Z')), '2026-01-02')
  assert.equal(outreachDay(new Date('2026-07-01T22:00:00Z')), '2026-07-02')
  assert.equal(outreachDay(new Date('2026-03-29T22:00:00Z')), '2026-03-30')
  assert.equal(outreachDay(new Date('2026-10-25T23:00:00Z')), '2026-10-26')
})

function sendFixture(dates: Date[] = []) {
  const events: string[] = []
  const fixture = {
    async mailboxCreate(path: string) { assert.equal(path, OUTREACH_SEND_LOCK); events.push('lock'); return {} },
    async mailboxDelete(path: string) { assert.equal(path, OUTREACH_SEND_LOCK); events.push('unlock'); return {} },
    async mailboxOpen() {},
    async search(query: { or?: unknown; since?: Date; header?: unknown }, options?: { uid?: boolean }) {
      if (query.or) return []
      assert.deepEqual(query.header, { 'X-Outreach-ID': '' })
      assert.equal(query.since?.toISOString(), '2026-07-01T00:00:00.000Z')
      assert.equal(options?.uid, true)
      return dates.map((_date, index) => index + 1)
    },
    async *fetch() { for (const internalDate of dates) yield { internalDate } },
    async append(path: string, raw: string, flags: string[], date: Date) {
      assert.equal(path, 'Sent'); assert.equal(raw, 'raw message')
      assert.deepEqual(flags, ['\\Seen', '\\Draft'])
      assert.equal(date.toISOString(), '2026-07-01T22:01:00.000Z')
      events.push('reserve'); return { uid: 42 }
    },
    async messageFlagsRemove(uid: number, flags: string[], options: unknown) {
      assert.equal(uid, 42); assert.deepEqual(flags, ['\\Draft']); assert.deepEqual(options, { uid: true })
      events.push('finalize'); return true
    },
  }
  const invoke = (deliver = async () => { events.push('smtp') }, limit = 10) => sendOutreach(
    fixture as unknown as ImapFlow, { sent: 'Sent', drafts: 'Drafts' }, { id: 'test', to: 'office@example.ch' }, 'raw message', deliver, limit, () => new Date('2026-07-01T22:01:00Z'),
  )
  return { fixture, events, invoke }
}

test('send reserves a durable sent copy before SMTP and then finalizes it under the lock', async () => {
  const { events, invoke } = sendFixture([new Date('2026-07-01T21:59:00Z')])
  assert.deepEqual(await invoke(), { sent: 1, skipped: 0, limitReached: false })
  assert.deepEqual(events, ['lock', 'reserve', 'smtp', 'finalize', 'unlock'])
})

test('tenth daily message is allowed, eleventh and disabled sending never call SMTP', async () => {
  for (const [count, limit, expected] of [[9, 10, 1], [10, 10, 0], [0, 0, 0]]) {
    const { events, invoke } = sendFixture(Array.from({ length: count }, () => new Date('2026-07-01T22:00:00Z')))
    const result = await invoke(undefined, limit)
    assert.equal(result.sent, expected)
    assert.equal(result.limitReached, !expected)
    assert.equal(events.includes('smtp'), Boolean(expected))
  }
})

test('uncertain SMTP delivery retains the reservation and releases the lock without finalizing', async () => {
  const { events, invoke } = sendFixture()
  await assert.rejects(invoke(async () => { events.push('smtp'); throw new Error('SMTP timeout') }), /SMTP timeout/)
  assert.deepEqual(events, ['lock', 'reserve', 'smtp', 'unlock'])
})

test('concurrent send cannot acquire or remove another request lock', async () => {
  const { fixture, events, invoke } = sendFixture()
  fixture.mailboxCreate = async () => { throw new Error('Already exists') }
  await assert.rejects(invoke(), OutreachSendBusy)
  assert.deepEqual(events, [])
})

test('duplicate under the send lock skips SMTP', async () => {
  const { fixture, events, invoke } = sendFixture()
  fixture.search = async () => [12]
  assert.deepEqual(await invoke(), { sent: 0, skipped: 1, limitReached: false })
  assert.deepEqual(events, ['lock', 'unlock'])
})

test('CTA is the actual question, including legacy templates, never the farewell', () => {
  const body = 'Guten Tag\n\nText\n\nKönnten Sie den Link weiterleiten?\n\nFreundliche Grüsse\n\nMoritz\nWebsite'
  assert.equal(outreachCallToAction({ body }), 'Könnten Sie den Link weiterleiten?')
  assert.equal(outreachCallToAction({ body, callToAction: 'Könnten Sie den Link weiterleiten?' }), 'Könnten Sie den Link weiterleiten?')
  assert.throws(() => outreachCallToAction({ body, callToAction: 'Freundliche Grüsse' }))
  assert.throws(() => outreachCallToAction({ body, callToAction: 'Erfundene Frage?' }))
})

test('sent messages and edited drafts are skipped without writing or deleting', async () => {
  for (const matches of [[[4]], [[], [9]], [[], []]]) {
    const opened: string[] = []
    const client = {
      async mailboxOpen(path: string, options: { readOnly: boolean }) { assert.equal(options.readOnly, true); opened.push(path) },
      async search(query: unknown) {
        assert.deepEqual(query, { or: [{ header: { 'X-Outreach-ID': 'test' } }, { to: 'office@example.ch' }] })
        return matches[opened.length - 1]
      },
    }
    assert.equal(await existingOutreach(client, ['Sent', 'Drafts'], { id: 'test', to: 'office@example.ch' }), matches.flat().length > 0)
  }
})

test('failed mailbox lookup cannot be mistaken for a new recipient', async () => {
  const client = { async mailboxOpen() {}, async search() { return false as const } }
  await assert.rejects(() => existingOutreach(client, ['Sent'], { id: 'test', to: 'office@example.ch' }))
})

test('German greetings are normalized for Switzerland, Germany and Austria', () => {
  assert.equal(
    formatOutreachGreeting('Guten Tag,\n\nich schreibe Ihnen.\n\nhttps://wasstudieren.ch', 'de'),
    'Guten Tag\n\nIch schreibe Ihnen.\n\nhttps://wasstudieren.ch',
  )
  for (const domain of ['findemeinstudium.de', 'wasstudieren.at']) {
    assert.equal(
      formatOutreachGreeting(`Guten Tag\n\nIch bin auf Ihre Website gestossen und heisse Moritz.\n\nhttps://${domain}`, 'de'),
      `Guten Tag,\n\nich bin auf Ihre Website gestoßen und heiße Moritz.\n\nhttps://${domain}`,
    )
  }
})


const SIGNATURE = '<img src="https://whatshouldistudy.com/icon-192.png"><div>wasstudieren</div><a href="https://wasstudieren.ch">wasstudieren.ch</a><a href="mailto:team@whatshouldistudy.com">team@whatshouldistudy.com</a>'

test('country website URLs survive rewriting and render as full clickable links with one local signature', () => {
  for (const [tld, domain, name] of [['ch', 'wasstudieren.ch', 'wasstudieren'], ['de', 'findemeinstudium.de', 'findemeinstudium'], ['at', 'wasstudieren.at', 'wasstudieren']]) {
    const urls = [`https://${domain}`, `https://${domain}/organisationen`]
    const body = `Guten Tag\n\n${urls.join('\n')}\n\nMoritz Lauper\n${name}\n${domain}\nteam@whatshouldistudy.com`
    assert.deepEqual(outreachWebsiteUrls(body), urls)
    assert.equal(isSwissGermanOutreach(body, 'de'), tld === 'ch')
    assert.deepEqual(outreachSite(body), { domain, name })
    const html = outreachHtmlBody(body, SIGNATURE)
    for (const url of urls) assert.ok(html.includes(`<a href="${url}">${url}</a>`))
    assert.ok(html.includes(`<img src="https://${domain}/icon-192.png"><div>${name}</div><a href="https://${domain}">${domain}</a>`))
    assert.ok(!html.includes('Moritz Lauper'), 'plain signature is replaced by the HTML signature')
    if (tld !== 'ch') assert.ok(!html.includes('wasstudieren.ch'))
  }
  const fr = 'Bonjour,\n\nhttps://whatshouldistudy.ch/fr\nhttps://whatshouldistudy.ch/fr/organisationen\n\nMoritz Lauper\nwhatshouldistudy\nwhatshouldistudy.ch\nteam@whatshouldistudy.com'
  assert.deepEqual(outreachSite(fr), { domain: 'whatshouldistudy.ch', name: 'whatshouldistudy' })
  const frHtml = outreachHtmlBody(fr, SIGNATURE)
  assert.ok(frHtml.includes('<a href="https://whatshouldistudy.ch/fr/organisationen">'))
  assert.ok(frHtml.includes('<img src="https://whatshouldistudy.ch/icon-192.png"><div>whatshouldistudy</div><a href="https://whatshouldistudy.ch/fr">whatshouldistudy.ch</a>'))
  assert.ok(!frHtml.includes('Moritz Lauper') && !frHtml.includes('wasstudieren'))
  assert.equal(isSwissGermanOutreach('https://wasstudieren.ch/deutschland', 'de'), false)
  assert.deepEqual(outreachWebsiteUrls('https://findemeinstudium.de.evil.example'), [])
  assert.ok(!outreachHtmlBody('https://findemeinstudium.de.evil.example', '').includes('<a '))
})
