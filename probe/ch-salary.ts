// Temporary: find the BFS tables on graduates' income by field of study.
export {}
const get = async (u: string) => {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'whatshouldistudy-probe (github.com/moritzlauper/angebunden)' } })
    return { status: r.status, text: await r.text() }
  } catch (e) {
    return { status: 0, text: String(e) }
  }
}

for (const q of ['Einkommen Hochschulabsolventen', 'Erwerbseinkommen Absolventen', 'Absolventenbefragung', 'Hochschulabsolventen Einkommen Fachbereich', 'revenu diplômés hautes écoles']) {
  const r = await get(`https://opendata.swiss/api/3/action/package_search?q=${encodeURIComponent(q)}&rows=15`)
  let j: any = {}
  try { j = JSON.parse(r.text) } catch {}
  console.log(`## opendata «${q}»`, r.status, j.result?.count)
  for (const p of j.result?.results ?? []) {
    console.log('-', p.name, '|', p.title?.de ?? p.title?.fr, '|', (p.resources ?? []).map((x: any) => `${x.format}:${x.url}`).slice(0, 3).join(' '))
  }
}

const root = await get('https://www.pxweb.bfs.admin.ch/api/v1/de/')
console.log('## pxweb root', root.status, root.text.length)
let dbs: Array<{ dbid: string; text: string }> = []
try { dbs = JSON.parse(root.text) } catch { console.log(root.text.slice(0, 400)) }
const hits = dbs.filter((d) => /einkommen|lohn|absolvent|erwerbs/i.test(d.text))
for (const d of hits) console.log('-', d.dbid, '|', d.text)
for (const d of hits.filter((d) => /absolvent|hochschul/i.test(d.text)).slice(0, 8)) {
  const meta = await get(`https://www.pxweb.bfs.admin.ch/api/v1/de/${d.dbid}/${d.dbid}.px`)
  console.log(`### ${d.dbid}`, meta.status)
  try {
    const m = JSON.parse(meta.text)
    console.log(m.title)
    for (const v of m.variables ?? []) console.log('  *', v.code, '|', v.text, '|', v.valueTexts.length, '|', v.valueTexts.slice(0, 25).join(' ; '))
  } catch {
    console.log(meta.text.slice(0, 300))
  }
}
