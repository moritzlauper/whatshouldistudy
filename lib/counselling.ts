/** Matches public URLs and internal country rewrites alike. */
export const isCounsellingPath = (path: string) => /\/(?:beratung|counselling)\/?$/.test(path)
