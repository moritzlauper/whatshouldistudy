// Temporary: find the data API behind studyprogrammes.ch.
export {}
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; whatshouldistudy-probe)' }
const page = await (await fetch('https://www.studyprogrammes.ch/de', { headers: UA })).text()
const next = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(page)?.[1]
console.log('NEXT_DATA', next?.length, next?.slice(0, 1500))
const scripts = [...page.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
for (const s of scripts) {
  const js = await (await fetch(new URL(s, 'https://www.studyprogrammes.ch').toString(), { headers: UA })).text()
  const urls = [...new Set([...js.matchAll(/["'`]((?:https?:)?\/\/[^"'`\s]{4,120}|\/[a-z0-9_-]+\/[^"'`\s]{2,100})["'`]/gi)].map((m) => m[1]))].filter((x) => !/\.(png|svg|jpg|css|woff2?)$/.test(x))
  const fetches = [...js.matchAll(/fetch\(([^)]{0,140})\)/g)].map((m) => m[1])
  console.log(`## ${s} ${js.length}`)
  console.log('  urls:', urls.slice(0, 60).join(' '))
  console.log('  fetch:', fetches.slice(0, 20).join(' || '))
  const ctx = [...js.matchAll(/.{0,80}(api|graphql|elastic|search|solr)[^a-z].{0,80}/gi)].map((m) => m[0]).slice(0, 15)
  console.log('  ctx:', ctx.join('\n       '))
}
