// Temporary: the endpoints of api.studyprogrammes.ch.
export {}
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; whatshouldistudy-probe)', Accept: 'application/json' }
const page = await (await fetch('https://www.studyprogrammes.ch/de', { headers: UA })).text()
const chunks = [...page.matchAll(/<script[^>]+src="([^"]+chunks\/[^"]+)"/g)].map((m) => m[1])
for (const c of chunks) {
  const js = await (await fetch(new URL(c, 'https://www.studyprogrammes.ch').toString(), { headers: UA })).text()
  const paths = [...new Set([...js.matchAll(/["'`](\/[a-z][a-z0-9_\-/]{2,60}(?:\?[^"'`]{0,60})?)["'`]/gi)].map((m) => m[1]))].filter((x) => !/^\/(_next|static|favicon|admin|protocol|js|locales)/.test(x))
  console.log(`## ${c}: ${paths.slice(0, 80).join(' ')}`)
  for (const m of [...js.matchAll(/.{0,120}\.concat\([^)]{0,40}\)[^;]{0,120}(studyprogramme|search|filter|institut)[^;]{0,80}/gi)].slice(0, 12)) console.log('   >', m[0].replace(/\s+/g, ' '))
}
for (const path of ['/', '/studyprogrammes', '/studyprogramme', '/api/studyprogrammes', '/search', '/studyprogrammes/search', '/filters', '/institutes', '/areas_of_study', '/v1/studyprogrammes']) {
  try {
    const r = await fetch('https://api.studyprogrammes.ch' + path, { headers: UA })
    const t = await r.text()
    console.log(`API ${path} → ${r.status} ${r.headers.get('content-type')} ${t.length}: ${t.slice(0, 300).replace(/\s+/g, ' ')}`)
  } catch (e) {
    console.log(`API ${path} → ${e}`)
  }
}
