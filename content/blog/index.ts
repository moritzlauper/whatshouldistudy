// Written by scripts/blog-index.ts: every post in this folder, oldest first.
import type { Post } from '../../lib/blog-check.ts'
import p0 from './2026-10-08-at-uni-oder-fh-zahlen-fristen-oesterreich.json' with { type: 'json' }
import p1 from './2026-10-08-ch-stipendium-im-studium-wer-bekommt-es-wie-viel.json' with { type: 'json' }
import p2 from './2026-10-08-de-studienort-waehlen-bundesland-bleiben-oder-umziehen.json' with { type: 'json' }
import p3 from './2026-10-08-dropping-out-switching-second-chances-numbers.json' with { type: 'json' }
import p4 from './2026-10-08-global-applying-to-uk-from-abroad-15-october-13-january.json' with { type: 'json' }
import p5 from './2026-10-09-at-lehramt-aufnahmeverfahren-oesterreich-modul-a-b-c.json' with { type: 'json' }
import p6 from './2026-10-09-ch-was-kostet-ein-studium-in-der-schweiz-studiengebuehren.json' with { type: 'json' }
import p7 from './2026-10-09-de-bafoeg-studienstart-2026-27-wohnkostenpauschale-2027.json' with { type: 'json' }

export const POSTS = [p0, p1, p2, p3, p4, p5, p6, p7] as Post[]
