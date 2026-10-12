import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('general similarities neither claim a very good subject fit nor appear twice in the explanation', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    import { pathToFileURL } from 'node:url';
    import { readFileSync } from 'node:fs';
    import ts from 'typescript';
    const root = pathToFileURL(process.cwd() + '/');
    registerHooks({
      resolve(specifier, context, next) {
        return next(specifier.startsWith('@/') ? new URL(specifier.slice(2), root).href : specifier, context);
      },
      load(url, context, next) {
        if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true,
          source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
            module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
          } }).outputText,
        };
        return next(url, context);
      },
    });
    const React = (await import('react')).default;
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { SiteProvider } = await import('./app/ui/site-context.tsx');
    const { AiBlock } = await import('./app/ui/readings.tsx');
    const fact = { id: 'theology', enough: true, riasec: [0, 5, 2, 5, 1, 2], subjects: ['lang', 'hist'], topics: ['religious-studies'], check: '' };
    const fit = { score: 85, reasons: [{ kind: 'riasec', types: ['S', 'I'] }, { kind: 'subjects', subjects: ['lang', 'hist'] }] };
    const personal = { id: 'theology', fit: 5, score: 85, thin: false, reasons: [
      'Ähnliches Tätigkeitsprofil: Sozial · Forschend',
      'Gemeinsame schulische Grundlagen: Deutsch & Literatur · Geschichte',
    ] };
    for (const personalStatus of ['rated', 'off']) {
      const html = renderToStaticMarkup(React.createElement(SiteProvider, { site: 'ch', base: '', locale: 'de-CH' },
        React.createElement(AiBlock, { fact, fit, personal, personalStatus,
          fieldReason: 'Hauptsächliches Studienfeld: Religionswissenschaft, in deinem Ergebnis auf Platz 6.',
        })));
      assert.ok(html.includes('Hauptsächliches Studienfeld'));
      assert.ok(html.includes('belegen kein Interesse'));
      assert.ok(!html.includes('Passt sehr gut'));
      assert.equal(html.match(/Ähnliches Tätigkeitsprofil/g)?.length, 1);
    }
  `], { cwd: process.cwd(), encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
