import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('checkout rejects stale Stripe prices and accepts matching local amounts', () => {
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { reportPriceId } from './lib/server/stripe.ts';
    process.env.STRIPE_PRICE_ID = 'price_report';
    let stored = { active: true, currency: 'chf', unit_amount: 1700, recurring: null };
    globalThis.fetch = async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname === '/v1/prices') {
        assert.equal(parsed.searchParams.get('lookup_keys[]'), 'wsis_report');
        return { ok: true, json: async () => ({ data: [{ id: 'price_report' }] }) };
      }
      assert.equal(parsed.pathname, '/v1/prices/price_report');
      assert.equal(parsed.searchParams.get('expand[]'), 'currency_options');
      return { ok: true, json: async () => stored };
    };
    const chf = { amount: 9, currency: 'CHF' };
    assert.equal(await reportPriceId(chf), null);
    delete process.env.STRIPE_PRICE_ID;
    assert.equal(await reportPriceId(chf), null);
    stored.unit_amount = 900;
    assert.equal(await reportPriceId(chf), 'price_report');
    assert.equal(await reportPriceId({ amount: 9, currency: 'EUR' }), null);
    stored.currency_options = { eur: { unit_amount: 1700 }, usd: { unit_amount: 900 } };
    assert.equal(await reportPriceId({ amount: 9, currency: 'EUR' }), null);
    assert.equal(await reportPriceId({ amount: 9, currency: 'USD' }), 'price_report');
    stored.currency_options.eur.unit_amount = 900;
    assert.equal(await reportPriceId({ amount: 9, currency: 'EUR' }), 'price_report');
    stored.active = false;
    assert.equal(await reportPriceId(chf), null);
    stored.active = true;
    stored.recurring = { interval: 'month' };
    assert.equal(await reportPriceId(chf), null);
  `], { encoding: 'utf8', env: { ...process.env, STRIPE_SECRET_KEY: 'test-only' } })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
