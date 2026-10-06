// Temporary: paging and details of api.studyprogrammes.ch.
export {}
const API = 'https://api.studyprogrammes.ch'
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; whatshouldistudy-probe)', Accept: 'application/json' }
const j = async (u: string) => {
  const r = await fetch(u, { headers: UA })
  const t = await r.text()
  try { return { s: r.status, d: JSON.parse(t) } } catch { return { s: r.status, d: t.slice(0, 200) } }
}
const first = await j(API + '/list_studyprogrammes')
console.log('metadata', JSON.stringify(first.d.metadata), 'n', first.d.data?.length, 'keys', Object.keys(first.d.data?.[0] ?? {}).join(','))
console.log('item', JSON.stringify(first.d.data?.[1]).slice(0, 1500))
for (const q of ['page=2', 'page=1', 'p=2', 'offset=20', 'page_number=2', 'filter_params=' + encodeURIComponent(JSON.stringify({ page: 2 })), 'degree_level=1', 'degree_levels=1', 'language=de', 'languages=de', 'q=soziologie', 'search=soziologie', 'search_term=soziologie', 'limit=100', 'page_size=100', 'per_page=100']) {
  const r = await j(`${API}/list_studyprogrammes?${q}`)
  console.log(q.padEnd(30), r.s, JSON.stringify(r.d.metadata ?? ''), r.d.data?.length, r.d.data?.[0]?.id, r.d.data?.[0]?.name)
}
const id = first.d.data?.[0]?.id
const vid = first.d.data?.[0]?.version_id
for (const q of [`id=${id}`, `studyprogramme_id=${id}`, `studyprogrammeId=${id}`, `version_id=${vid}`, `id=${id}&lang=de`]) {
  const r = await j(`${API}/get_studyprogramme_details?${q}`)
  console.log('details', q, r.s, JSON.stringify(r.d).slice(0, 2500))
}
