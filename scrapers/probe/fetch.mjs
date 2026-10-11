// Probe: fetches the pages named in scrapers/probe/urls.json ({ "name": "url" }) from a GitHub runner
// (the build sandbox can't reach them) and saves each as probe-out/<name>.html with a first line
// «<!-- url status final-url -->». One request every 1.5 s, our usual user agent.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
const UA = 'Mozilla/5.0 (compatible; wasstudieren-bot/1.0; +https://wasstudieren.ch)'
const urls = JSON.parse(readFileSync('scrapers/probe/urls.json', 'utf8'))
mkdirSync('probe-out', { recursive: true })
for (const [name, u] of Object.entries(urls)) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'de-AT,de-DE,de;q=0.9,en;q=0.5' }, signal: AbortSignal.timeout(60000) })
    const buf = new Uint8Array(await r.arrayBuffer())
    const head = new TextDecoder('latin1').decode(buf.slice(0, 4000))
    const cs = /charset=([\w-]+)/i.exec(r.headers.get('content-type') ?? '')?.[1] ?? /<meta[^>]+charset="?([\w-]+)/i.exec(head)?.[1] ?? 'utf-8'
    let t
    try { t = new TextDecoder(cs).decode(buf) } catch { t = new TextDecoder().decode(buf) }
    writeFileSync(`probe-out/${name}.html`, `<!-- ${u} ${r.status} ${r.url} -->\n${t}`)
    console.log(`${name} ${r.status} ${t.length} ${r.url}`)
  } catch (e) {
    writeFileSync(`probe-out/${name}.html`, `<!-- ${u} ERR ${e.message} -->\n`)
    console.log(`${name} ERR ${e.message}`)
  }
  await new Promise((r) => setTimeout(r, 1500))
}
