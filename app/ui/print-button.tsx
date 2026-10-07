'use client'

/** Prints the page; the print styles in globals.css reduce it to the worksheet. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-primary btn-sm print:hidden">
      {label}
    </button>
  )
}
