import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('landing checkout preserves the site, language, fixed price and safe return URLs', () => {
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    import { pathToFileURL } from 'node:url';
    const root = pathToFileURL(process.cwd() + '/');
    registerHooks({ resolve(specifier, context, next) {
      if (specifier.startsWith('@/')) return next(new URL(specifier.slice(2), root).href, context);
      return next(specifier === 'next/server' ? 'next/server.js' : specifier, context);
    } });
    const { POST } = await import('./app/api/checkout/route.ts');
    let form;
    globalThis.fetch = async (url, options) => {
      const path = new URL(url).pathname;
      if (path === '/v1/prices') return { ok: true, json: async () => ({ data: [] }) };
      assert.equal(path, '/v1/checkout/sessions');
      form = options.body;
      return { ok: true, json: async () => ({ url: 'https://checkout.stripe.com/test-session' }) };
    };
    for (const [query, cancel, success, currency] of [
      ['site=ch&back=/schweiz&from=landing', '/schweiz#pricing', '/schweiz/freigeschaltet', 'chf'],
      ['site=ch&from=landing', '/#pricing', '/freigeschaltet', 'chf'],
      ['site=ch&locale=fr-CH&from=landing', '/fr#pricing', '/fr/freigeschaltet', 'chf'],
      ['site=ch&locale=it-CH&from=landing', '/it#pricing', '/it/freigeschaltet', 'chf'],
      ['site=ch&locale=it-CH', '/it/resultat#corsi', '/it/freigeschaltet', 'chf'],
      ['site=ch&locale=fr-CH', '/fr/resultat#programmes', '/fr/freigeschaltet', 'chf'],
      ['site=global&from=landing', '/#pricing', '/unlocked', 'usd'],
      ['site=ch&back=/schweiz', '/schweiz/resultat#studiengaenge', '/schweiz/freigeschaltet', 'chf'],
      ['site=ch&from=landing&o=https://evil.example&back=https://evil.example', '/#pricing', '/freigeschaltet', 'chf'],
    ]) {
      const response = await POST(new Request('https://preview.example/api/checkout?' + query, { method: 'POST' }));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).url, 'https://checkout.stripe.com/test-session');
      assert.equal(form.get('cancel_url'), 'https://preview.example' + cancel);
      assert.equal(form.get('success_url'), 'https://preview.example' + success + '?session_id={CHECKOUT_SESSION_ID}');
      assert.equal(form.get('line_items[0][price_data][unit_amount]'), '900');
      assert.equal(form.get('line_items[0][price_data][currency]'), currency);
      assert.equal(form.get('mode'), 'payment');
      assert.equal(form.get('metadata[product]'), 'wsis_report');
      if(query.includes('it-CH')) {assert.equal(form.get('metadata[locale]'),'it-CH');assert.equal(form.get('locale'),'it');}
      assert.match(form.get('custom_text[submit][message]'), query.includes('it-CH') ? /recedere entro 14 giorni/ : query.includes('fr-CH') ? /rétracter dans les 14 jours/ : query.includes('global') ? /withdraw within 14 days/ : /innert 14 Tagen.*auch nach dem Öffnen/);
    }
  `], {
    encoding: 'utf8',
    env: { ...process.env, STRIPE_SECRET_KEY: 'sk_test_mock', WSIS_TOKEN_SECRET: 'test-only', STRIPE_PRICE_ID: '', WSIS_FREE_UNLOCK: '', NEXT_PUBLIC_BASE_PATH: '', WSIS_ALLOWED_ORIGINS: '' },
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
