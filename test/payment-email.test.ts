import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { validStripeSignature } from '../lib/server/stripe-webhook.ts'

test('Stripe signature rejects tampering, stale/future timestamps and wrong secrets; supports rotation', () => {
  const body = Buffer.from('{"type":"checkout.session.completed"}')
  const t = Math.floor(Date.now() / 1000)
  const signature = createHmac('sha256', 'test-secret').update(`${t}.`).update(body).digest('hex')
  const header = `t=${t},v1=${'0'.repeat(64)},v1=${signature}`
  assert.ok(validStripeSignature(body, header, 'test-secret', t * 1000))
  assert.equal(validStripeSignature(Buffer.from('{}'), header, 'test-secret', t * 1000), false)
  assert.equal(validStripeSignature(body, header, 'wrong', t * 1000), false)
  assert.equal(validStripeSignature(body, header, 'test-secret', (t + 301) * 1000), false)
  assert.equal(validStripeSignature(body, header, 'test-secret', (t - 301) * 1000), false)
  assert.equal(validStripeSignature(body, `t=${t},v1=oops`, 'test-secret'), false)
  assert.equal(validStripeSignature(body, null, 'test-secret'), false)
})

test('paid emails: trusted links, languages, duplicate events, SMTP failure retry and webhook authentication', () => {
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    import { pathToFileURL } from 'node:url';
    import { createHmac } from 'node:crypto';
    import nodemailer from 'nodemailer';
    const root = pathToFileURL(process.cwd() + '/');
    registerHooks({ resolve(specifier, context, next) {
      if (specifier.startsWith('@/')) return next(new URL(specifier.slice(2), root).href, context);
      return next(specifier === 'next/server' ? 'next/server.js' : specifier, context);
    } });
    const { paymentEmail, sendPaymentEmail } = await import('./lib/server/payment-email.ts');
    const { POST } = await import('./app/api/stripe/webhook/route.ts');
    const s = {id:'cs_test_purchase1', mode:'payment',payment_status:'paid',success_url:'https://whatshouldistudy.ch/it/freigeschaltet?session_id={CHECKOUT_SESSION_ID}',metadata:{site:'ch',locale:'it-CH'},customer_details:{email:'buyer@example.com'}};
    assert.match(paymentEmail(s).text, /Non devi pagare di nuovo/);
    assert.match(paymentEmail(s).text, /session_id=cs_test_purchase1/);
    for (const language of ['de','en','fr','it']) assert.ok(paymentEmail({...s,metadata:{site:'ch',locale:language}}).subject);
    assert.match(paymentEmail(s).text, /Diritto di recesso[\\s\\S]*anche se hai già aperto il report[\\s\\S]*Modulo tipo di recesso/);
    assert.match(paymentEmail({...s,metadata:{site:'ch',locale:'de-CH'}}).text, /Widerrufsrecht[\\s\\S]*innert 14 Tagen[\\s\\S]*Muster-Widerrufsformular/);
    assert.match(paymentEmail({...s,metadata:{site:'de',locale:'de-DE'}}).text, /innerhalb von 14 Tagen[\\s\\S]*außer wir vereinbaren/);
    assert.match(paymentEmail({...s,metadata:{site:'ch',locale:'xx'}}).text, /Right of withdrawal/);
    assert.equal(paymentEmail({...s,payment_status:'unpaid'}),null);
    assert.equal(paymentEmail({...s,mode:'subscription'}),null);
    assert.equal(paymentEmail({...s,success_url:'https://evil.example/freigeschaltet'}),null);
    assert.equal(paymentEmail({...s,success_url:'https://whatshouldistudy.ch/something-else'}),null);
    assert.equal(paymentEmail({...s,metadata:{site:'ch',product:'other'}}),null);
    assert.throws(()=>paymentEmail({...s,customer_details:{email:'bad\\r\\nBcc: x'}}));
    assert.ok(paymentEmail({...s,metadata:{site:'ch'}})); // Existing purchases.
    const store=new Map(); let attempts=0; let fail=false; let held; let release;
    globalThis.fetch=async (_url, opts)=>{
      const [cmd,key,value,...args]=JSON.parse(opts.body); let result;
      if(cmd==='GET') result=store.get(key)??null;
      if(cmd==='SET') {result=args.includes('NX')&&store.has(key)?null:'OK';if(result)store.set(key,value);}
      if(cmd==='EVAL') {const lock=args[0], owner=args[1];result=store.get(lock)===owner?1:0;if(result)store.delete(lock);}
      return {ok:true,json:async()=>({result})};
    };
    nodemailer.createTransport=()=>({close(){},async sendMail(mail){attempts++;assert.equal(mail.to,'buyer@example.com');if(held)await held;if(fail)throw Error('SMTP');return {accepted:[mail.to]};}});
    assert.equal(await sendPaymentEmail(s),'sent');
    assert.equal(await sendPaymentEmail(s),'already-sent');assert.equal(attempts,1);
    const retry={...s,id:'cs_test_retry'};fail=true;
    await assert.rejects(()=>sendPaymentEmail(retry));fail=false;
    assert.equal(await sendPaymentEmail(retry),'sent');
    held=new Promise(r=>release=r);const concurrent={...s,id:'cs_test_concurrent'};
    const first=sendPaymentEmail(concurrent);await new Promise(r=>setTimeout(r,10));
    await assert.rejects(()=>sendPaymentEmail(concurrent));release();await first;held=null;
    assert.equal(await sendPaymentEmail(concurrent),'already-sent');
    async function request(session,type='checkout.session.completed',signed=true,live=false){
      const body=JSON.stringify({type,livemode:live,data:{object:session}});const t=Math.floor(Date.now()/1000);
      const signature=createHmac('sha256','whsec_test').update(t+'.'+body).digest('hex');
      return POST(new Request('https://example.com/api/stripe/webhook',{method:'POST',headers:signed?{'stripe-signature':'t='+t+',v1='+signature}:{},body}));
    }
    assert.equal((await request(s,undefined,false)).status,400);
    assert.equal((await request(s,undefined,true,true)).status,400);
    const count=attempts;
    assert.equal((await request({...s,payment_status:'unpaid'})).status,200);assert.equal(attempts,count);
    fail=true;assert.equal((await request({...s,id:'cs_test_async'},'checkout.session.async_payment_succeeded')).status,503);
    fail=false;assert.equal((await request({...s,id:'cs_test_async'},'checkout.session.async_payment_succeeded')).status,200);
    assert.equal((await request({...s,id:'cs_test_async'})).status,200);
    const { POST: recover } = await import('./app/api/stripe/recover-email/route.ts');
    const originalFetch=globalThis.fetch;
    globalThis.fetch=async(url,options)=>String(url).startsWith('https://api.stripe.com/')?{ok:true,json:async()=>({...s,id:'cs_test_recovery',metadata:{site:'ch'},locale:'de'})}:originalFetch(url,options);
    const recoveryRequest=(auth,body)=>new Request('https://example.com/api/stripe/recover-email',{method:'POST',headers:{authorization:auth},body:JSON.stringify(body)});
    assert.equal((await recover(recoveryRequest('Bearer wrong',{session_id:'cs_test_recovery'}))).status,401);
    nodemailer.createTransport=()=>({close(){},async sendMail(mail){assert.equal(mail.to,'buyer@example.com');assert.match(mail.text,/Non devi pagare di nuovo/);assert.ok(mail.text.includes('https://whatshouldistudy.ch/it/freigeschaltet'));return {accepted:[mail.to]};}});
    assert.equal((await recover(recoveryRequest('Bearer owner-test',{session_id:'cs_test_recovery',locale:'it-CH',email:'attacker@example.com'}))).status,200);
    const { NextRequest } = await import('next/server.js');
    const { proxy } = await import('./proxy.ts');
    const redirect=proxy(new NextRequest('https://whatshouldistudy.ch/freigeschaltet?session_id=cs_test_old',{headers:{'accept-language':'it-CH'}}));
    assert.equal(redirect.headers.get('location'),'https://whatshouldistudy.ch/it/freigeschaltet?session_id=cs_test_old');
  `], { encoding: 'utf8', env: {...process.env, SMTP_PASSWORD:'test', USAGE_ADMIN_TOKEN:'owner-test', STRIPE_SECRET_KEY:'sk_test_mock', STRIPE_WEBHOOK_SECRET:'whsec_test', NEXT_PUBLIC_CH_URL:'https://wasstudieren.ch', NEXT_PUBLIC_CH_FR_IT_URL:'https://whatshouldistudy.ch', NEXT_PUBLIC_SITE_URL:'https://whatshouldistudy.com'} })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
