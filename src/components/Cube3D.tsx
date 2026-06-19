import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { CubeColor, CubeState, FaceName, Move } from '@/types/cube'
import { HEX_FOR_COLOR } from '@/types/cube'
import { buildFaceletString } from '@/services/cubeValidation/validator'

/**
 * Animated 3D Rubik's cube.
 *
 * The 27 cubies live inside a single rotating Object3D ("cubieGroup"). Each
 * move animates a temporary pivot containing the 9 cubies of the rotating
 * layer; after the animation we bake the transform back into each cubie and
 * snap to integer grid coordinates so the next move starts from a clean
 * state.
 *
 * The component keeps its own cursor of which solution step the visual cube
 * is currently at, so a parent re-render that only changes `playStep` no
 * longer triggers a full rebuild + replay (the old code did, which caused a
 * visible "double move" right after each animation finished).
 */

interface Props {
  state: CubeState
  /** Solution moves; rendered statically until `playStep` advances. */
  moves: Move[]
  /** Index of the move currently being shown (number already executed). */
  playStep: number
  /** Set to true to animate from playStep → playStep+1. */
  animating: boolean
  /** Idle auto-rotation of the whole cube. */
  autoRotate: boolean
  onAnimationEnd?: () => void
}

const SIZE = 1
const GAP = 0.04

export function Cube3D({ state, moves, playStep, animating, autoRotate, onAnimationEnd }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const apiRef = useRef<ReturnType<typeof createScene> | null>(null)
  /** Index of the move that's already baked into the cubies' visual state. */
  const visualStepRef = useRef(0)

  // Mount the Three.js scene once.
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const api = createScene(mount)
    apiRef.current = api
    return () => {
      apiRef.current = null
      api.dispose()
    }
  }, [])

  // Rebuild only when the underlying scanned cube or full solution changes.
  useEffect(() => {
    const api = apiRef.current
    if (!api) return
    api.rebuild(state)
    const target = Math.min(Math.max(playStep, 0), moves.length)
    for (let i = 0; i < target; i++) api.applyMoveInstant(moves[i])
    visualStepRef.current = target
    // Intentionally NOT depending on playStep — that drift is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, moves])

  // Sync to playStep changes without rebuilding (forward = instant apply,
  // backward = rebuild + replay).
  useEffect(() => {
    const api = apiRef.current
    if (!api) return
    if (animating) return // animation completion handles forward advancement
    const target = Math.min(Math.max(playStep, 0), moves.length)
    if (target === visualStepRef.current) return
    if (target > visualStepRef.current) {
      for (let i = visualStepRef.current; i < target; i++) api.applyMoveInstant(moves[i])
    } else {
      api.rebuild(state)
      for (let i = 0; i < target; i++) api.applyMoveInstant(moves[i])
    }
    visualStepRef.current = target
  }, [playStep, animating, moves, state])

  // Animate a single move when `animating` flips on. We always animate the
  // move that sits just past the current visual step — never two at once.
  useEffect(() => {
    const api = apiRef.current
    if (!api) return
    if (!animating) return
    const next = moves[visualStepRef.current]
    if (!next) {
      onAnimationEnd?.()
      return
    }
    let cancelled = false
    api.animateMove(next, 600).then(() => {
      if (cancelled) return
      visualStepRef.current += 1
      onAnimationEnd?.()
    })
    return () => {
      cancelled = true
    }
  }, [animating, moves, onAnimationEnd])

  // Toggle the idle spin.
  useEffect(() => {
    apiRef.current?.setAutoRotate(autoRotate)
  }, [autoRotate])

  return <div ref={mountRef} className="h-full w-full touch-none select-none" />
}

/** ---- Scene factory ----------------------------------------------------- */

interface Cubie {
  mesh: THREE.Mesh
  /** Integer grid coordinates (-1, 0, 1). */
  pos: THREE.Vector3
}

function createScene(mount: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const measure = () => {
    const r = mount.getBoundingClientRect()
    return {
      w: Math.max(r.width || mount.clientWidth || 320, 200),
      h: Math.max(r.height || mount.clientHeight || 320, 200),
    }
  }
  let { w, h } = measure()
  renderer.setSize(w, h)
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.touchAction = 'none'
  mount.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100)
  camera.position.set(5, 5, 6.5)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const key = new THREE.DirectionalLight(0xffffff, 0.6)
  key.position.set(4, 6, 5)
  scene.add(key)

  const cubieGroup = new THREE.Group()
  // Start at a nicer initial angle so all three visible faces are showing.
  cubieGroup.rotation.set(-0.35, -0.45, 0)
  scene.add(cubieGroup)

  let cubies: Cubie[] = []

  // -------- Manual drag rotation + auto-spin -----------------------------

  let autoSpin = true
  let dragging = false
  let lastX = 0
  let lastY = 0

  const onPointerDown = (e: PointerEvent) => {
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
    try {
      renderer.domElement.setPointerCapture(e.pointerId)
    } catch {
      // Some browsers (older Safari) throw if the pointer isn't capturable.
    }
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    cubieGroup.rotation.y += dx * 0.01
    cubieGroup.rotation.x += dy * 0.01
    // Clamp X so the user can't flip the cube upside down accidentally.
    const limit = Math.PI / 2
    if (cubieGroup.rotation.x > limit) cubieGroup.rotation.x = limit
    if (cubieGroup.rotation.x < -limit) cubieGroup.rotation.x = -limit
  }
  const onPointerUp = (e: PointerEvent) => {
    dragging = false
    try {
      renderer.domElement.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('pointerup', onPointerUp)
  renderer.domElement.addEventListener('pointercancel', onPointerUp)
  renderer.domElement.addEventListener('pointerleave', onPointerUp)

  function setAutoRotate(v: boolean) {
    autoSpin = v
  }

  // -------- Scene update / rendering loop -------------------------------

  function rebuild(state: CubeState) {
    while (cubieGroup.children.length) cubieGroup.remove(cubieGroup.children[0])
    cubies = []

    const colors = colorMap(state)

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const geom = new THREE.BoxGeometry(SIZE, SIZE, SIZE)
          const materials: THREE.MeshStandardMaterial[] = [
            facelet(colors, 'R', x, y, z),
            facelet(colors, 'L', x, y, z),
            facelet(colors, 'U', x, y, z),
            facelet(colors, 'D', x, y, z),
            facelet(colors, 'F', x, y, z),
            facelet(colors, 'B', x, y, z),
          ]
          const mesh = new THREE.Mesh(geom, materials)
          const step = SIZE + GAP
          mesh.position.set(x * step, y * step, z * step)
          cubieGroup.add(mesh)
          cubies.push({ mesh, pos: new THREE.Vector3(x, y, z) })
        }
      }
    }
  }

  function applyMoveInstant(move: Move) {
    const { axis, layer, angle } = moveAxis(move)
    const pivot = new THREE.Object3D()
    cubieGroup.add(pivot)
    for (const c of cubies) {
      if (Math.round(c.pos.getComponent(axisIndex(axis))) === layer) {
        pivot.attach(c.mesh)
      }
    }
    pivot.rotation[axis] = angle
    pivot.updateMatrixWorld(true)
    for (const c of [...cubies]) {
      if (c.mesh.parent === pivot) {
        cubieGroup.attach(c.mesh)
        snap(c.mesh)
        c.pos.copy(roundVec(c.mesh.position.clone().divideScalar(SIZE + GAP)))
      }
    }
    cubieGroup.remove(pivot)
  }

  async function animateMove(move: Move, durationMs: number) {
    const { axis, layer, angle } = moveAxis(move)
    const pivot = new THREE.Object3D()
    cubieGroup.add(pivot)
    const involved: Cubie[] = []
    for (const c of cubies) {
      if (Math.round(c.pos.getComponent(axisIndex(axis))) === layer) {
        pivot.attach(c.mesh)
        involved.push(c)
      }
    }

    await new Promise<void>((resolve) => {
      const start = performance.now()
      function step(now: number) {
        const t = Math.min(1, (now - start) / durationMs)
        const eased = easeInOut(t)
        pivot.rotation[axis] = angle * eased
        if (t < 1) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })

    for (const c of involved) {
      cubieGroup.attach(c.mesh)
      snap(c.mesh)
      c.pos.copy(roundVec(c.mesh.position.clone().divideScalar(SIZE + GAP)))
    }
    cubieGroup.remove(pivot)
  }

  let raf = 0
  function loop() {
    raf = requestAnimationFrame(loop)
    if (autoSpin && !dragging) cubieGroup.rotation.y += 0.0015
    renderer.render(scene, camera)
  }
  loop()

  const ro = new ResizeObserver(() => {
    const next = measure()
    w = next.w
    h = next.h
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  })
  ro.observe(mount)
  requestAnimationFrame(() => {
    const next = measure()
    renderer.setSize(next.w, next.h)
    camera.aspect = next.w / next.h
    camera.updateProjectionMatrix()
  })

  function dispose() {
    cancelAnimationFrame(raf)
    ro.disconnect()
    renderer.domElement.removeEventListener('pointerdown', onPointerDown)
    renderer.domElement.removeEventListener('pointermove', onPointerMove)
    renderer.domElement.removeEventListener('pointerup', onPointerUp)
    renderer.domElement.removeEventListener('pointercancel', onPointerUp)
    renderer.domElement.removeEventListener('pointerleave', onPointerUp)
    renderer.dispose()
    if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
  }

  return { rebuild, applyMoveInstant, animateMove, dispose, setAutoRotate }
}

/** Build a flat array of facelet colours keyed by `${face}:${cellIndex}`. */
function colorMap(state: CubeState): Map<string, CubeColor> {
  const map = new Map<string, CubeColor>()
  for (const [face, scanned] of Object.entries(state.faces)) {
    if (!scanned) continue
    scanned.facelets.forEach((c, i) => map.set(`${face}:${i}`, c))
  }
  return map
}

function facelet(
  colors: Map<string, CubeColor>,
  face: FaceName,
  x: number,
  y: number,
  z: number,
): THREE.MeshStandardMaterial {
  const dark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
  let cellIndex = -1
  switch (face) {
    case 'U':
      if (y !== 1) return dark
      cellIndex = (1 - z) * 3 + (x + 1)
      break
    case 'D':
      if (y !== -1) return dark
      cellIndex = (z + 1) * 3 + (x + 1)
      break
    case 'F':
      if (z !== 1) return dark
      cellIndex = (1 - y) * 3 + (x + 1)
      break
    case 'B':
      if (z !== -1) return dark
      cellIndex = (1 - y) * 3 + (1 - x)
      break
    case 'L':
      if (x !== -1) return dark
      cellIndex = (1 - y) * 3 + (z + 1)
      break
    case 'R':
      if (x !== 1) return dark
      cellIndex = (1 - y) * 3 + (1 - z)
      break
  }
  const c = colors.get(`${face}:${cellIndex}`)
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(c ? HEX_FOR_COLOR[c] : '#222'),
    roughness: 0.4,
  })
}

function moveAxis(move: Move): { axis: 'x' | 'y' | 'z'; layer: number; angle: number } {
  const ninety = (Math.PI / 2) * (move.turns === 2 ? 2 : 1) * (move.turns === -1 ? 1 : -1)
  switch (move.face) {
    case 'U':
      return { axis: 'y', layer: 1, angle: ninety }
    case 'D':
      return { axis: 'y', layer: -1, angle: -ninety }
    case 'R':
      return { axis: 'x', layer: 1, angle: ninety }
    case 'L':
      return { axis: 'x', layer: -1, angle: -ninety }
    case 'F':
      return { axis: 'z', layer: 1, angle: ninety }
    case 'B':
      return { axis: 'z', layer: -1, angle: -ninety }
  }
  return { axis: 'y', layer: 0, angle: 0 }
}

function axisIndex(a: 'x' | 'y' | 'z'): 0 | 1 | 2 {
  return a === 'x' ? 0 : a === 'y' ? 1 : 2
}

function snap(mesh: THREE.Object3D) {
  mesh.updateMatrixWorld(true)
  const step = SIZE + GAP
  mesh.position.x = Math.round(mesh.position.x / step) * step
  mesh.position.y = Math.round(mesh.position.y / step) * step
  mesh.position.z = Math.round(mesh.position.z / step) * step
  mesh.rotation.x = snapAngle(mesh.rotation.x)
  mesh.rotation.y = snapAngle(mesh.rotation.y)
  mesh.rotation.z = snapAngle(mesh.rotation.z)
  mesh.quaternion.setFromEuler(mesh.rotation)
}

function snapAngle(a: number): number {
  const q = Math.PI / 2
  return Math.round(a / q) * q
}

function roundVec(v: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(Math.round(v.x), Math.round(v.y), Math.round(v.z))
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

/** Unused convenience export for callers that want to debug facelet strings. */
export function debugFaceletString(state: CubeState): string | null {
  return buildFaceletString(state)
}
