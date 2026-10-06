// Temporary: how studyprogrammes.ch (swissuniversities) serves its programmes and their profiles.
export {}
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; whatshouldistudy-probe; github.com/moritzlauper/angebunden)' }
const get = async (u: string) => {
  try {
    const r = await fetch(u, { headers: UA, redirect: 'follow' })
    return { status: r.status, url: r.url, type: r.headers.get('content-type') ?? '', text: await r.text() }
  } catch (e) {
    return { status: 0, url: u, type: '', text: String(e) }
  }
}
for (const u of ['https://www.studyprogrammes.ch/de', 'https://www.studyprogrammes.ch/', 'https://www.studyprogrammes.ch/sitemap.xml', 'https://www.studyprogrammes.ch/robots.txt']) {
  const r = await get(u)
  console.log(`## ${u} → ${r.status} ${r.url} ${r.type} ${r.text.length}`)
  console.log(r.text.slice(0, 1500).replace(/\s+/g, ' '))
  const scripts = [...r.text.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
  console.log('scripts:', scripts.join(' '))
  const apis = [...new Set([...r.text.matchAll(/["'](\/?api\/[^"']{2,80}|https?:\/\/[^"']*api[^"']{0,80})["']/g)].map((m) => m[1]))]
  console.log('api-ish:', apis.slice(0, 30).join(' '))
  for (const s of scripts.slice(0, 6)) {
    const js = await get(new URL(s, r.url).toString())
    const found = [...new Set([...js.text.matchAll(/["'`](\/?api\/[^"'`]{2,100}|https?:\/\/[^"'`\s]{4,100})["'`]/g)].map((m) => m[1]))]
    console.log(`  js ${s} ${js.status} ${js.text.length}:`, found.filter((x) => /api|json|graphql|search|programme|studien/i.test(x)).slice(0, 40).join(' '))
  }
}
