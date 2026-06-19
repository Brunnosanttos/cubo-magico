import { useEffect, useRef } from 'react'

/**
 * Drive a callback (typically a Three.js render loop) at requestAnimationFrame
 * cadence while `active` is true.
 */
export function useAnimationFrame(callback: (dt: number) => void, active = true) {
  const cbRef = useRef(callback)
  useEffect(() => {
    cbRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!active) return
    let last = performance.now()
    let raf = 0
    const loop = (t: number) => {
      const dt = (t - last) / 1000
      last = t
      cbRef.current(dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active])
}
