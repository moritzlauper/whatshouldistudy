import localFont from 'next/font/local'

/** Bricolage Grotesque (SIL Open Font License, see app/fonts/OFL.txt), variable weight and width. */
export const bricolage = localFont({
  src: '../fonts/bricolage.woff2',
  variable: '--font-bricolage',
  weight: '200 800',
  display: 'swap',
})
