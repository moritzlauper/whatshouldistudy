/** A small, exact progress indicator for completed AI work. */
export function ScanProgress({ done, total, label }: { done: number; total: number; label: string }) {
  const maximum = Math.max(1, total)
  const value = Math.max(0, Math.min(done, maximum))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={maximum}
      aria-valuenow={value}
      className="h-1 w-full max-w-sm overflow-hidden rounded-full bg-surface-2"
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(value / maximum) * 100}%` }} />
    </div>
  )
}
