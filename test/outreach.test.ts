import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existingOutreach, outreachCallToAction } from '../lib/outreach.ts'

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
