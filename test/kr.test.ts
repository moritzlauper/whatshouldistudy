import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FIELDS } from '../lib/taxonomy/fields.ts'
import { KR_SUBFIELDS, krCity, krFields, krLevel, parentName, parseDepartments, parseSchools, siteKey, tidyEnglish } from '../scrapers/kr-academyinfo.ts'

const fixture = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'scrapers', 'fixtures', 'kr-academyinfo.json'), 'utf8')) as { list: string[][]; schools: string[][] }

test('every Korean subcategory maps to fields we know', () => {
  const ids = new Set(FIELDS.map((f) => f.id))
  for (const [sub, [en, fields]] of Object.entries(KR_SUBFIELDS)) {
    assert.ok(en, sub)
    for (const f of fields) assert.ok(ids.has(f), `${sub}: ${f}`)
  }
})

test('the department name sharpens the official category', () => {
  assert.deepEqual(krFields('컴퓨터공학과', '전기・전자・컴퓨터', '전산학・컴퓨터공학').fields, ['computer-science', 'computer-engineering'])
  assert.equal(krFields('인공지능소프트웨어학과', '전기・전자・컴퓨터', '응용소프트웨어공학').fields[0], 'artificial-intelligence')
  assert.equal(krFields('경영학과', '경영・경제', '경영학').confidence, 1)
  // Unclassified (N.C.E.): the middle category, else the name.
  assert.deepEqual(krFields('자유전공학부', 'N.C.E', 'N.C.E.').fields, ['liberal-arts'])
  assert.deepEqual(krFields('기계융합학부', '기계', 'N.C.E.').fields, ['mechanical-engineering'])
  assert.deepEqual(krFields('뷰티스타일학과', 'N.C.E', '뷰티아트').fields, [])
})

test('Korean degrees become levels', () => {
  assert.equal(krLevel('학사', 4, '경영학'), 'bachelor')
  assert.equal(krLevel('학사', 6, '의학'), 'professional')
  assert.equal(krLevel('전문학사', 2, '간호학'), 'short')
  assert.equal(krLevel('석사,박사, 석박사통합', 4, '화학'), 'master')
  assert.equal(krLevel('박사', 3, '화학'), 'doctorate')
  assert.equal(krLevel('학석사통합', 5, '화학'), 'integrated')
})

test('names, cities and lookup keys', () => {
  assert.equal(parentName('서울대학교 대학원'), '서울대학교')
  assert.equal(parentName('가야대학교 일반대학원(김해)'), '가야대학교(김해)')
  assert.equal(parentName('서울대학교'), '서울대학교')
  assert.equal(krCity('1 Kangwondaehak-gil, Chuncheon-si, Gangwon-do'), 'Chuncheon')
  assert.equal(krCity('80, Daehak-ro, Buk-gu, Daegu, Republic of Korea'), 'Daegu')
  assert.equal(krCity('1103, Daegaya-ro, Daegaya-eup, Goryeong-gun, Gyeongsangbuk-do'), 'Goryeong')
  assert.equal(tidyEnglish('University Of Seoul'), 'University of Seoul')
  assert.equal(tidyEnglish('GANGSEO UNIVERSITY'), 'Gangseo University')
  assert.equal(siteKey('Korea University Sejong Campus'), siteKey('Korea University'))
  assert.equal(siteKey('The Catholic University of Korea'), siteKey('Catholic University of Korea'))
})

test('academyinfo rows become programmes', () => {
  const { programmes } = parseDepartments(fixture.list, parseSchools(fixture.schools), '2026-01-01T00:00:00.000Z')
  assert.ok(programmes.length > 50)
  assert.ok(programmes.every((p) => p.country === 'KR' && p.fields.length && p.tuition?.currency === 'KRW'))
  // Closed departments and admission units are left out.
  assert.ok(!programmes.some((p) => /모집단위/.test(p.name)))
  const snu = programmes.filter((p) => p.institution === 'Seoul National University')
  assert.ok(snu.some((p) => p.level === 'bachelor') && snu.some((p) => p.level === 'master'), 'graduate school goes by its university')
  assert.ok(snu.every((p) => p.city === 'Seoul' && p.public && p.institutionType === 'uni'))
  assert.ok(programmes.some((p) => p.level === 'short' && p.institutionType === undefined), 'junior college')
  assert.ok(programmes.some((p) => p.mode === 'distance'), 'cyber university')
  assert.ok(programmes.some((p) => p.institutionType === 'ph'), 'university of education')
})
