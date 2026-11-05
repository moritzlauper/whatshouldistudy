/**
 * SEO analysis tools (Ahrefs, Semrush and the like). Crawling some 200,000
 * programme pages, they cost server time and bring no visitors, so they are
 * asked to stay away (robots.txt) and turned away before a page renders
 * (proxy.ts), since some ignore robots.txt. Search engines and AI crawlers
 * (Googlebot, Bingbot, GPTBot, ClaudeBot, PerplexityBot …) stay welcome: they
 * bring the site into search results and AI answers.
 */
export const HEAVY_BOTS = ['AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'DataForSeoBot', 'BLEXBot', 'Barkrowler', 'serpstatbot']

const pattern = new RegExp(HEAVY_BOTS.join('|'), 'i')
export const isHeavyBot = (userAgent: string | null) => !!userAgent && pattern.test(userAgent)
