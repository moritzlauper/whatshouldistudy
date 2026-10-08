import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existingOutreach, formatOutreachGreeting, outreachCallToAction, outreachHtmlBody, outreachSite, outreachWebsiteUrls, isSwissGermanOutreach } from '../lib/outreach.ts'

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


test('country website URLs survive rewriting and render as full clickable links with one local signature', () => {
  for (const [tld, domain, name] of [['ch', 'wasstudieren.ch', 'wasstudieren'], ['de', 'findemeinstudium.de', 'findemeinstudium'], ['at', 'wasstudieren.at', 'wasstudieren']]) {
    const urls = [`https://${domain}`, `https://${domain}/organisationen`]
    const body = `Guten Tag\n\n${urls.join('\n')}\n\nMoritz Lauper\n${name}\n${domain}\nteam@whatshouldistudy.com`
    assert.deepEqual(outreachWebsiteUrls(body), urls)
    assert.equal(isSwissGermanOutreach(body, 'de'), tld === 'ch')
    assert.deepEqual(outreachSite(body), { domain, name })
    const html = outreachHtmlBody(body, '<div>wasstudieren</div><a href="https://wasstudieren.ch">wasstudieren.ch</a>')
    for (const url of urls) assert.ok(html.includes(`<a href="${url}">${url}</a>`))
    assert.ok(html.includes(`<div>${name}</div><a href="https://${domain}">${domain}</a>`))
    assert.ok(!html.includes('Moritz Lauper'), 'plain signature is replaced by the HTML signature')
    if (tld !== 'ch') assert.ok(!html.includes('wasstudieren.ch'))
  }
  const fr = 'Bonjour,\n\nhttps://whatshouldistudy.ch/fr\nhttps://whatshouldistudy.ch/fr/organisationen\n\nMoritz Lauper\nwhatshouldistudy\nwhatshouldistudy.ch\nteam@whatshouldistudy.com'
  assert.deepEqual(outreachSite(fr), { domain: 'whatshouldistudy.ch', name: 'whatshouldistudy' })
  const frHtml = outreachHtmlBody(fr, '<div>wasstudieren</div><a href="https://wasstudieren.ch">wasstudieren.ch</a>')
  assert.ok(frHtml.includes('<a href="https://whatshouldistudy.ch/fr/organisationen">'))
  assert.ok(frHtml.includes('<div>whatshouldistudy</div><a href="https://whatshouldistudy.ch">whatshouldistudy.ch</a>'))
  assert.ok(!frHtml.includes('Moritz Lauper') && !frHtml.includes('wasstudieren'))
  assert.equal(isSwissGermanOutreach('https://wasstudieren.ch/deutschland', 'de'), false)
  assert.deepEqual(outreachWebsiteUrls('https://findemeinstudium.de.evil.example'), [])
  assert.ok(!outreachHtmlBody('https://findemeinstudium.de.evil.example', '').includes('<a '))
})
