import { test } from 'node:test'
import assert from 'node:assert/strict'

test('facts from an official page: robots.txt, page text and only what the page backs up', async () => {
  const { spawnSync } = await import('node:child_process')
  // server-only modules use React's server export condition in this isolated process.
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { robotsAllow, pageText, sameSite, verified } from './lib/official-facts.ts';
    const robots = 'User-agent: Googlebot\\nDisallow: /\\n\\nUser-agent: *\\nDisallow: /intern/\\nDisallow: /*index.html$\\nAllow: /intern/studium/';
    assert.equal(robotsAllow(robots, 'https://x.ch/de/studium/psychologie.html'), true);
    assert.equal(robotsAllow(robots, 'https://x.ch/intern/a.html'), false);
    assert.equal(robotsAllow(robots, 'https://x.ch/intern/studium/a.html'), true);
    assert.equal(robotsAllow(robots, 'https://x.ch/a/index.html'), false);
    assert.equal(robotsAllow(robots, 'https://x.ch/a/index_ger.html'), true);
    assert.equal(robotsAllow('', 'https://x.ch/a'), true);
    assert.equal(sameSite('https://www.psychologie.uzh.ch/de/x', 'https://www.uzh.ch'), true);
    assert.equal(sameSite('https://example.com/x', 'https://www.uzh.ch'), false);
    assert.equal(sameSite('https://www.ox.ac.uk/a', 'https://www.cam.ac.uk'), false);
    const text = pageText('<nav>Menü Informatik</nav><h1>Master Psychologie</h1><p>Wählen Sie eine der Vertiefungen Klinische Psychologie, Neuro&shy;psychologie oder Arbeitspsychologie.</p><p>Das Studium ist auch in Teilzeit möglich.</p><script>var x=1</script>');
    assert.ok(!text.includes('Menü') && !text.includes('var x'));
    assert.equal(pageText('<li>Exoplan&eacute;tologie</li><li>Des &eacute;toiles &agrave; l&rsquo;Univers</li><li>Fran&#xE7;ais</li>'), 'Exoplanétologie\\nDes étoiles à l’Univers\\nFrançais');
    const f = verified({
      specialisations: ['Klinische Psychologie', 'Arbeitspsychologie', 'Sozialpsychologie'],
      free_choice: { value: true, quote: 'frei wählbar' },
      part_time: { value: true, quote: 'auch in Teilzeit möglich' },
      start_autumn: { value: true, quote: 'Studienbeginn im Herbst' },
      start_spring: { value: false, quote: '' },
      internship: { value: false, quote: '' },
      degree: 'Master of Science UZH in Psychologie',
    }, text);
    const free = verified({ specialisations: [], free_choice: { value: true, quote: 'ein Masterstudium mit individuellem Studienprofil, ausgerichtet auf Berufszielen' }, part_time: { value: true, quote: 'nur drei Wörter' }, start_autumn: { value: false, quote: '' }, start_spring: { value: false, quote: '' }, internship: { value: false, quote: '' }, degree: '' }, 'Sie wählen ein Masterstudium mit individuellem Studienprofil, ausgerichtet auf Berufsziele.');
    assert.equal(free.freeChoice, true);
    assert.equal(free.partTime, false);
    // Names and quotes not on the page are dropped; a list of names rules out «no fixed specialisations».
    assert.deepEqual(f, { specialisations: ['Klinische Psychologie', 'Arbeitspsychologie'], freeChoice: false, partTime: true, start: [], internship: false, degree: undefined });
  `], { cwd: process.cwd(), encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})
