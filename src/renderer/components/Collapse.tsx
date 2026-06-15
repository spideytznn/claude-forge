import type { ReactNode } from 'react'

/** Height-only collapse via `grid-rows 0fr↔1fr` (no max-height guessing). The
 *  inner overflow-hidden clips children mid-tween. Always mounted, so BOTH
 *  expand and collapse animate — unlike a mount-rendered popover, which can
 *  only animate on open. This is the single primitive behind every disclosure
 *  in the app (nav, dropdowns, selects). */
export default function Collapse({
  open,
  children,
  className
}: {
  open: boolean
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-[420ms] ease-spring ${
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      } ${className ?? ''}`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
