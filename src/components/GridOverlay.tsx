import type { CubeColor } from '@/types/cube'
import { HEX_FOR_COLOR } from '@/types/cube'

interface Props {
  colors: CubeColor[]
  /** Fraction of the smaller viewport dimension that the grid occupies. */
  sizeFraction?: number
  highlight?: boolean
}

/**
 * Translucent 3x3 grid overlay drawn on top of the camera feed.
 *
 * The grid only paints the *border* of each cell so the user can still see the
 * sticker underneath; the detected colour is reflected on a small chip in the
 * corner of every cell.
 */
export function GridOverlay({ colors, sizeFraction = 0.7, highlight }: Props) {
  const sizeStyle = `${sizeFraction * 100}vmin`

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ width: sizeStyle, height: sizeStyle }}
    >
      <div
        className={`grid h-full w-full grid-cols-3 grid-rows-3 gap-1 rounded-2xl border-2 ${
          highlight ? 'border-emerald-400' : 'border-white/70'
        } p-1 backdrop-blur-[1px]`}
      >
        {Array.from({ length: 9 }).map((_, i) => {
          const color = colors[i]
          return (
            <div
              key={i}
              className="relative flex items-center justify-center rounded-lg border border-white/40"
            >
              {color && (
                <span
                  className="absolute right-1 top-1 h-3 w-3 rounded-sm shadow"
                  style={{ background: HEX_FOR_COLOR[color] }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
