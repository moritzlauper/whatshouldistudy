'use client'

import { useId } from 'react'
import { priceForSite } from '@/lib/pricing.ts'
import { useConfig } from './price.tsx'
import { useSite } from './site-context.tsx'

/** TWINT's own mark, white on black (File:Twint.svg, uploaded to Wikimedia Commons by TWINT). */
export function TwintLogo() {
  const id = useId()
  return (
    <span className="inline-flex shrink-0 items-center rounded-lg border-2 border-line bg-black px-2 py-1">
      <svg viewBox="0 0 140 46" role="img" aria-label="TWINT" className="h-5 w-auto">
        <defs>
          <radialGradient cx="22.45%" cy="8.76%" fx="22.45%" fy="8.76%" r="113.287%" id={`${id}a`}>
            <stop stopColor="#fc0" offset="0%" /><stop stopColor="#FFC800" offset="9.157%" /><stop stopColor="#FFBD00" offset="17.39%" /><stop stopColor="#FFAB00" offset="25.28%" /><stop stopColor="#FF9100" offset="32.95%" /><stop stopColor="#FF7000" offset="40.46%" /><stop stopColor="#FF4700" offset="47.86%" /><stop stopColor="#FF1800" offset="55.03%" /><stop stopColor="#f00" offset="58.22%" /><stop stopColor="#f00" offset="100%" />
          </radialGradient>
          <radialGradient cx="2.431%" cy="14.525%" fx="2.431%" fy="14.525%" r="139.175%" id={`${id}b`}>
            <stop stopColor="#00B4E6" offset="0%" /><stop stopColor="#00B0E3" offset="20.1%" /><stop stopColor="#01A5DB" offset="38.98%" /><stop stopColor="#0292CD" offset="57.37%" /><stop stopColor="#0377BA" offset="75.46%" /><stop stopColor="#0455A1" offset="93.16%" /><stop stopColor="#054696" offset="100%" />
          </radialGradient>
        </defs>
        <path fill="#fff" d="M39.902 33.438c0 .59-.418 1.304-.933 1.599l-18.028 10.428c-.516.295-1.351.295-1.867 0l-18.028-10.428c-.516-.295-.933-1.008-.933-1.599v-20.856c0-.59.418-1.304.933-1.599l18.028-10.428c.516-.295 1.351-.295 1.867 0l18.028 10.428c.516.295.933 1.008.933 1.599v20.856zM139.989 14.082h-16.137v3.861h5.796v16.503h4.568v-16.503h5.772zM66.674 14.082h-16.161v3.861h5.796v16.503h4.568v-16.503h5.796zM113.389 13.443c-5.084 0-7.909 3.246-7.909 7.944v13.06h4.519v-13.158c0-2.041 1.204-3.615 3.439-3.615 2.235 0 3.414 1.869 3.414 3.615v13.158h4.519v-13.06c.025-4.698-2.898-7.944-7.982-7.944zM96.344 14.082v20.364h4.519v-20.364zM81.018 22.149l.147.91 4.249 11.387h1.842l5.772-20.364h-4.446l-2.751 10.699-.172 1.156-.221-1.156-3.684-10.699h-1.474l-3.684 10.699-.221 1.156-.147-1.156-2.751-10.699h-4.47l5.772 20.364h1.842l4.249-11.387.147-.91" />
        <path fill={`url(#${id}a)`} d="M29.414 23.059l-4.716 6.911-2.407-3.689 2.775-4.156c.516-.738 1.621-2.779.344-5.558-1.032-2.263-3.267-3.345-5.232-3.345-1.965 0-4.102 1.008-5.256 3.345-1.302 2.681-.172 4.771.319 5.485 0 0 1.547 2.263 2.825 4.181l2.088 3.025 3.144 4.821c.025.025.516.787 1.4.787.835 0 1.351-.762 1.425-.836l7.368-10.92h-4.077v-.049zm-9.26.172s-1.228-1.869-2.039-3.173c-.86-1.402.098-3.492 2.039-3.492 1.94 0 2.898 2.091 2.039 3.492-.786 1.304-2.039 3.173-2.039 3.173z" />
        <path fill={`url(#${id}b)`} d="M15.635 29.749l-4.618-6.493s-1.228-1.869-2.039-3.173c-.86-1.402.098-3.492 2.039-3.492.246 0 .467.025.688.098l1.621-2.976c-.737-.32-1.547-.492-2.284-.492-1.965 0-4.102 1.008-5.256 3.345-1.302 2.681-.172 4.771.319 5.485l8.081 11.978c.074.098.589.861 1.449.861.86 0 1.351-.738 1.425-.836l2.432-3.714-2.088-3.074-1.768 2.484z" />
      </svg>
    </span>
  )
}

/** «Bezahlen mit TWINT oder Karte» wherever checkout charges CHF, the currency Stripe offers TWINT for. */
export function PayWithTwint({ className = '' }: { className?: string }) {
  const { site, t } = useSite()
  const config = useConfig(site)
  // Before the config arrives, the site price decides, so the Swiss site renders it on the server.
  const price = config?.price ?? priceForSite(site)
  if ((config && config.payments !== 'stripe') || price.currency !== 'CHF') return null
  const [before, after] = t.programmes.payTwint
  return (
    <p className={`flex flex-wrap items-center gap-2 text-sm font-semibold ${className}`}>
      {before} <TwintLogo /> {after}
    </p>
  )
}
