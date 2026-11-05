/**
 * Crawlers that are not search engines: AI training crawlers and SEO tools.
 * Crawling some 200,000 programme pages, they cost far more server time than
 * they bring visitors, so they are asked to stay away (robots.txt) and turned
 * away before a page renders (proxy.ts), since some ignore robots.txt.
 * Search engines (Googlebot, Bingbot, DuckDuckBot, Applebot) are not listed.
 */
export const HEAVY_BOTS = [
  'GPTBot', 'CCBot', 'ClaudeBot', 'anthropic-ai', 'Claude-Web', 'Bytespider', 'meta-externalagent', 'Amazonbot',
  'PetalBot', 'AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'DataForSeoBot', 'BLEXBot', 'Barkrowler', 'serpstatbot',
  'ImagesiftBot', 'Diffbot', 'omgili', 'Timpibot',
]

const pattern = new RegExp(HEAVY_BOTS.map((bot) => bot.replace(/[-]/g, '\\-')).join('|'), 'i')
export const isHeavyBot = (userAgent: string | null) => !!userAgent && pattern.test(userAgent)
