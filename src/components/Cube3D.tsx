import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { CubeColor, CubeState, FaceName, Move } from '@/types/cube'
import { HEX_FOR_COLOR } from '@/types/cube'
import { buildFaceletString } from '@/services/cubeValidation/validator'

/**
 * Animated 3D Rubik's cube.
 *
 * Internally the cube is a 3x3x3 grid of "cubie" meshes. To animate a move we
 * group the 9 cubies on the rotating face into a pivot Object3D, animate the
 * pivot's rotation, and once the animation completes we bake the transform
 * back into each cubie and re-snap them to their integer grid coordinates.
 */

interface Props {
  state: CubeState
  /** Solution moves; rendered statically until `playStep` advances. */
  moves: Move[]
  /** Index of the move currently being shown (number already executed). */
  playStep: number
  /** Set to true to animate from playStep → playStep+1. */
  animating: boolean
  onAnimationEnd?: () => void
}

const SIZE = 1
const GAP = 0.04

export function Cube3D({ state, moves, playStep, animating, onAnimationEnd }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const apiRef = useRef<ReturnType<typeof createScene> | null>(null)

  // Mount the Three.js scene once.
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const api = createScene(mount)
    apiRef.current = api
    return () => api.dispose()
  }, [])

  // Whenever the cube state or playStep changes, rebuild and fast-forward.
  useEffect(() => {
    const api = apiRef.current
    if (!api) return
    api.rebuild(state)
    // Replay the first `playStep` moves instantly (no animation).
    for (let i = 0; i < playStep && i < moves.length; i++) {
      api.applyMoveInstant(moves[i])
    }
  }, [state, playStep, moves])

  // Animate next move on demand.
  useEffect(() => {
    const api = apiRef.current
    if (!api) return
    if (!animating) return
    const move = moves[playStep]
    if (!move) {
      onAnimationEnd?.()
      return
    }
    api.animateMove(move, 600).then(() => onAnimationEnd?.())
  }, [animating, moves, playStep, onAnimationEnd])

  return <div ref={mountRef} className="h-full w-full" />
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
  const initialSize = mount.getBoundingClientRect()
  renderer.setSize(initialSize.width, initialSize.height || 320)
  mount.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
  camera.position.set(5, 5, 6.5)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const key = new THREE.DirectionalLight(0xffffff, 0.6)
  key.position.set(4, 6, 5)
  scene.add(key)

  const cubieGroup = new THREE.Group()
  scene.add(cubieGroup)

  let cubies: Cubie[] = []

  function rebuild(state: CubeState) {
    while (cubieGroup.children.length) cubieGroup.remove(cubieGroup.children[0])
    cubies = []

    const colors = colorMap(state)

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const geom = new THREE.BoxGeometry(SIZE, SIZE, SIZE)
          // Default to a dark plastic core; overwrite outer faces with stickers.
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
        // Snap rotation + recalc integer grid position.
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
    cubieGroup.rotation.y += 0.0015
    renderer.render(scene, camera)
  }
  loop()

  const ro = new ResizeObserver(() => {
    const { width, height } = mount.getBoundingClientRect()
    const h = height || width * 0.75
    renderer.setSize(width, h)
    camera.aspect = width / h
    camera.updateProjectionMatrix()
  })
  ro.observe(mount)

  function dispose() {
    cancelAnimationFrame(raf)
    ro.disconnect()
    renderer.dispose()
    if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
  }

  return { rebuild, applyMoveInstant, animateMove, dispose }
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

/**
 * Look up the colour for the outer face of cubie (x,y,z). Returns the dark
 * plastic colour for inward-facing sides.
 */
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
  const sign = move.turns === -1 ? 1 : -1 // visual rotation sign convention
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
  return { axis: 'y', layer: 0, angle: 0 * sign }
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
