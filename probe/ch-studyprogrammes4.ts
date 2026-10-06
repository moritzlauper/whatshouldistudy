// Temporary: try the api.studyprogrammes.ch endpoints.
export {}
const API = 'https://api.studyprogrammes.ch'
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; whatshouldistudy-probe)', Accept: 'application/json', 'Content-Type': 'application/json' }
const show = async (label: string, url: string, init: RequestInit = {}) => {
  try {
    const r = await fetch(url, { ...init, headers: UA })
    const t = await r.text()
    console.log(`${label} ${url} → ${r.status} ${t.length}: ${t.slice(0, 700).replace(/\s+/g, ' ')}`)
    return t
  } catch (e) {
    console.log(`${label} ${url} → ${e}`)
    return ''
  }
}
for (const p of ['/list_fields_of_study', '/list_areas_of_study', '/list_degree_levels', '/list_institutes', '/list_studyprogrammes']) {
  await show('GET', API + p)
  await show('GET', API + p + '?lang=de')
  await show('POST', API + p, { method: 'POST', body: JSON.stringify({ lang: 'de' }) })
}
await show('GET', API + '/list_studyprogrammes?lang=de&page=1&limit=5')
await show('POST', API + '/list_studyprogrammes', { method: 'POST', body: JSON.stringify({ lang: 'de', page: 1, limit: 3, filter: {} }) })
