/** Temporary: where do programme-level links come from? */
const UA = { 'User-Agent': 'whatshouldistudy-data (+https://angebunden.ch/whatshouldistudy)' }
async function show(label: string, url: string, init: RequestInit = {}, n = 1500) {
  try {
    const res = await fetch(url, { redirect: 'follow', ...init, headers: { ...UA, ...(init.headers ?? {}) } })
    const text = await res.text()
    console.log(`\n=== ${label}: ${res.status} ${res.url} (${text.length} chars, ${res.headers.get('content-type')})`)
    const urls = [...new Set(text.match(/https?:\/\/[^"'<>\s\\]+/g) ?? [])].filter((u) => !/\.(png|jpg|svg|css|js|woff2?)(\?|$)/.test(u)).slice(0, 40)
    console.log('urls:', urls.join(' | '))
    const api = [...new Set(text.match(/["'](\/[a-z0-9_\-/]*api[a-z0-9_\-/.?=&]*)["']/gi) ?? [])].slice(0, 20)
    if (api.length) console.log('api paths:', api.join(' | '))
    console.log(text.replace(/\s+/g, ' ').slice(0, n))
  } catch (e) {
    console.log(`\n=== ${label}: failed ${(e as Error).message}`)
  }
}
const H = { 'X-API-Key': 'infosysbub-studisu' }
const BASE = 'https://rest.arbeitsagentur.de/infosysbub/studisu/pc/v1'
await show('DE detail 1', `${BASE}/studienangebote/10843171`, { headers: H }, 3000)
await show('DE detail 2', `${BASE}/studienangebot/10843171`, { headers: H }, 3000)
await show('DE detail 3', `${BASE}/studienangebote/10843171/details`, { headers: H }, 1000)
await show('DE web detail', 'https://web.arbeitsagentur.de/studiensuche/studienangebot/10843171', {}, 800)
await show('DE web search', 'https://web.arbeitsagentur.de/studiensuche/suche?sw=Soziologie', {}, 800)
await show('CH studyprogrammes', 'https://www.studyprogrammes.ch/', {}, 2000)
await show('CH studyprogrammes de', 'https://www.studyprogrammes.ch/de', {}, 1500)
await show('CH swissuniversities', 'https://www.swissuniversities.ch/themen/studium/studienangebot', {}, 1200)
await show('CH berufsberatung', 'https://www.berufsberatung.ch/dyn/show/2800', {}, 800)
await show('DDG ducky', 'https://duckduckgo.com/?q=%5CBachelor%20Soziologie%20site%3Auzh.ch', {}, 800)
await show('DDG html', 'https://html.duckduckgo.com/html/?q=Bachelor%20Soziologie%20site%3Auzh.ch', {}, 600)
