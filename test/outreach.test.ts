import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existingOutreach, outreachCallToAction, outreachHtmlBody, outreachWebsiteUrls, isSwissGermanOutreach } from '../lib/outreach.ts'

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


test('country website URLs survive rewriting and render as full clickable links with one local signature', () => {
  for (const tld of ['ch', 'de', 'at']) {
    const domain = `whatshouldistudy.${tld}`
    const urls = [`https://${domain}`, `https://${domain}/organisationen`]
    const body = `Guten Tag\n\n${urls.join('\n')}\n\nMoritz Lauper\nwhatshouldistudy\n${domain}\nteam@whatshouldistudy.com`
    assert.deepEqual(outreachWebsiteUrls(body), urls)
    assert.equal(isSwissGermanOutreach(body, 'de'), tld === 'ch')
    const html = outreachHtmlBody(body, '<a href="https://whatshouldistudy.ch">whatshouldistudy.ch</a>')
    for (const url of urls) assert.ok(html.includes(`<a href="${url}">${url}</a>`))
    assert.ok(html.includes(`<a href="https://${domain}">${domain}</a>`))
    assert.ok(!html.includes('Moritz Lauper'), 'plain signature is replaced by the HTML signature')
    if (tld !== 'ch') assert.ok(!html.includes('whatshouldistudy.ch'))
  }
  assert.equal(isSwissGermanOutreach('https://whatshouldistudy.ch/deutschland', 'de'), false)
  assert.deepEqual(outreachWebsiteUrls('https://whatshouldistudy.de.evil.example'), [])
  assert.ok(!outreachHtmlBody('https://whatshouldistudy.de.evil.example', '').includes('<a '))
})
