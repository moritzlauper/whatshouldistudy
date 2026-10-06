// Temporary: structure of the BFS table «Standardisiertes Bruttoerwerbseinkommen … ein Jahr nach Studienabschluss».
import { unzipSync, strFromU8 } from 'fflate'
const r = await fetch('https://dam-api.bfs.admin.ch/hub/api/dam/assets/36732661/master', { headers: { 'User-Agent': 'whatshouldistudy-probe' } })
const buf = new Uint8Array(await r.arrayBuffer())
console.log('status', r.status, r.headers.get('content-type'), r.headers.get('content-disposition'), buf.length, [...buf.slice(0, 4)].map((b) => b.toString(16)).join(' '))
if (buf[0] === 0x50 && buf[1] === 0x4b) {
  const files = unzipSync(buf)
  console.log(Object.keys(files).join(' '))
  const shared = [...strFromU8(files['xl/sharedStrings.xml'] ?? new Uint8Array()).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''))
  console.log('workbook:', strFromU8(files['xl/workbook.xml']).match(/<sheet [^>]+>/g)?.join(' '))
  for (const name of Object.keys(files).filter((n) => /^xl\/worksheets\/sheet(1[45])\.xml$/.test(n))) {
    const xml = strFromU8(files[name])
    console.log(`### ${name}`)
    let n = 0
    for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [...row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map((c) => {
        const v = /<v>([\s\S]*?)<\/v>/.exec(c[3] ?? '')?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(c[3] ?? '')?.[1] ?? ''
        return `${c[1]}=${/t="s"/.test(c[2]) ? shared[Number(v)] : v}`
      })
      if (cells.length) console.log(cells.join(' | '))
      if (++n > 60) break
    }
  }
}
