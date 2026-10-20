import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('assignment persists through navigation, outages and checkout; consent withdrawal wins request races', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    Date.now = () => Date.parse('2026-10-21T12:00:00Z');
    const storage = new Map();
    globalThis.localStorage = {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    };
    storage.set('wsis:consent', JSON.stringify({c:'granted',at:Date.now()}));
    const { ensurePaywallAssignment: enrol, experimentState: state, paywallParticipant: participant, clearPaywallAssignment: clear } = await import('./lib/paywall-experiment-client.ts');
    const { PAYWALL_EXPERIMENT } = await import('./lib/paywall-experiment.ts');
    let requests = [];
    globalThis.fetch = async (url, options) => {
      const v = JSON.parse(options.body);
      requests.push({ ...v, method: options.method });
      return Response.json({ assignment: {...v, variant:'late', assignedAt:Date.now(),inTest:true} });
    };
    await enrol('ch', false);
    assert.equal(requests.length, 0);
    await Promise.all([enrol('ch', true), enrol('ch', true)]);
    assert.equal(requests.length, 1);
    assert.equal(state('ch').assignment.variant, 'late');
    const id = participant('ch','opt-in');
    assert.equal(id, requests[0].id);
    await enrol('ch', false);
    assert.equal(requests.length, 1);
    assert.equal(participant('ch'), null);
    storage.set('wsis:consent', JSON.stringify({c:'denied',at:Date.now()}));
    assert.equal(participant('ch','opt-out'), null);
    clear('ch');
    assert.equal(state('ch'), null);
    assert.equal(requests.at(-1).method, 'DELETE');
    assert.equal(storage.has('wsis:experiment:'+PAYWALL_EXPERIMENT+':ch'), false);
    storage.set('wsis:consent', JSON.stringify({c:'granted',at:Date.now()}));
    let finish;
    globalThis.fetch = (url, options) => options.method === 'DELETE'
      ? Promise.resolve(new Response(null, {status:204}))
      : new Promise(resolve => { finish = () => resolve(Response.json({assignment:{...JSON.parse(options.body),variant:'direct',assignedAt:Date.now(),inTest:true}})); });
    const old = enrol('ch', true);
    clear('ch');
    const oldFinish = finish;
    const fresh = enrol('ch', true);
    const newId = JSON.parse(storage.get('wsis:experiment:'+PAYWALL_EXPERIMENT+':ch')).id;
    oldFinish();
    await old;
    assert.equal(state('ch').status, 'loading');
    finish();
    await fresh;
    assert.equal(participant('ch','opt-in'), newId);
    assert.equal(state('ch').assignment.variant, 'direct');
    globalThis.fetch = async () => { throw new Error('offline'); };
    const saved = {id:crypto.randomUUID(),createdAt:Date.now(),assignment:null};
    saved.assignment = {id:saved.id,site:'global',variant:'late',assignedAt:Date.now(),inTest:true};
    storage.set('wsis:experiment:'+PAYWALL_EXPERIMENT+':global',JSON.stringify(saved));
    await enrol('global',false);
    assert.equal(state('global').assignment.variant,'late');
  `], { encoding: 'utf8', env: {...process.env, NEXT_PUBLIC_BASE_PATH:''} })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
