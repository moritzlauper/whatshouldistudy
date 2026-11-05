import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isHeavyBot } from '../lib/site/bots.ts'

test('AI training crawlers and SEO tools are turned away, search engines and people are not', () => {
  for (const agent of [
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
    'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)',
    'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
    'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
  ]) assert.equal(isHeavyBot(agent), true, agent)
  for (const agent of [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    null,
  ]) assert.equal(isHeavyBot(agent), false, String(agent))
})
