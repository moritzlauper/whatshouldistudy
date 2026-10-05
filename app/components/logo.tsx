/** A compass needle over an open book. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M7 21.5c3-1.6 6-1.6 9 0 3-1.6 6-1.6 9 0V24c-3-1.6-6-1.6-9 0-3-1.6-6-1.6-9 0z" fill="var(--accent-ink)" opacity=".9" />
      <path d="M16 6l3 9-3 3-3-3z" fill="var(--coral)" />
      <path d="M16 18l-3-3 3 9 3-9z" fill="var(--accent-ink)" opacity=".85" />
    </svg>
  )
}
