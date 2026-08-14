/**
 * WebGL2 fire effect for the effort slider track (ported from the reference
 * effort-card demo): a three-pass simulation (ignition -> blur -> composite)
 * whose front edge follows the slider value. React adaptation: the slider and
 * active flags are read through refs that render keeps fresh, so the effect
 * runs a single mount-time loop without re-initialising on value changes.
 */
import { useEffect, useRef, type RefObject } from 'react'
import { VERT, FRAG_SIM, FRAG_BLUR, FRAG_COMP } from './shaders.ts'

/**
 * Start the fire loop on the given canvas.
 * @param canvasRef - the track canvas.
 * @param getSlider - returns the current slider position in 0..1.
 * @param getActive - whether the fire should burn (panel open).
 */
export function useWebglFire(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  getSlider: () => number,
  getActive: () => boolean,
): void {
  const sliderRef = useRef(0)
  const activeRef = useRef(false)
  // Fresh values for the mount-time loop without re-running the effect.
  sliderRef.current = getSlider()
  activeRef.current = getActive()

  // The mount-time effect owns the GL state; this ref lets a per-render
  // effect start the loop once the slider data arrives (the first render of
  // the panel usually has slider=0 because the directory is still loading).
  const ensureLoopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) {
      console.warn('[aurora-effort] fire: canvas not found')
      return
    }
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: false, antialias: false })
    if (gl === null) {
      console.warn('[aurora-effort] fire: webgl2 context unavailable (browser GPU/hardware acceleration off?)')
      return
    }

    let rafId: number | null = null
    let resizeObserver: ResizeObserver | null = null
    let resizeDebounce: number | undefined
    let loopRunning = false
    let idleFrames = 0
    let startTime: number | null = null
    let springValue = 0.7
    let springVelocity = 0
    let lastSpringTime = 0

    const MAX_IDLE = 180
    const SPRING_STIFFNESS = 7
    const SPRING_DAMP = 0.55

    let simProg: WebGLProgram | null = null
    let blurProg: WebGLProgram | null = null
    let compProg: WebGLProgram | null = null
    let vao: WebGLVertexArrayObject | null = null
    let vbo: WebGLBuffer | null = null
    let programsReady = false
    let simA: { fbo: WebGLFramebuffer; tex: WebGLTexture } | null = null
    let simB: { fbo: WebGLFramebuffer; tex: WebGLTexture } | null = null
    let blurH: { fbo: WebGLFramebuffer; tex: WebGLTexture } | null = null
    let blurV: { fbo: WebGLFramebuffer; tex: WebGLTexture } | null = null

    const U: Record<string, WebGLUniformLocation | null> = {}

    const onContextLost = (e: Event): void => e.preventDefault()
    const onContextRestored = (): void => {
      programsReady = false
      compilePrograms()
      if (programsReady) {
        resize()
        if (sliderRef.current > 0) ensureLoop()
      }
    }

    function compileShader(type: number, src: string): WebGLShader | null {
      const sh = gl.createShader(type)
      if (sh === null) return null
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh)
        return null
      }
      return sh
    }

    function linkProgram(vsSrc: string, fsSrc: string): WebGLProgram | null {
      const v = compileShader(gl.VERTEX_SHADER, vsSrc)
      const f = compileShader(gl.FRAGMENT_SHADER, fsSrc)
      if (v === null || f === null) return null
      const p = gl.createProgram()
      if (p === null) return null
      gl.attachShader(p, v)
      gl.attachShader(p, f)
      gl.bindAttribLocation(p, 0, 'a_pos')
      gl.linkProgram(p)
      gl.deleteShader(v)
      gl.deleteShader(f)
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null
      return p
    }

    function compilePrograms(): void {
      simProg = linkProgram(VERT, FRAG_SIM)
      blurProg = linkProgram(VERT, FRAG_BLUR)
      compProg = linkProgram(VERT, FRAG_COMP)
      if (simProg === null || blurProg === null || compProg === null) return

      vao = gl.createVertexArray()
      gl.bindVertexArray(vao)
      vbo = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
      ]), gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

      U.simTime = gl.getUniformLocation(simProg, 'u_time')
      U.simSlider = gl.getUniformLocation(simProg, 'u_slider')
      U.simElapsed = gl.getUniformLocation(simProg, 'u_elapsed')
      U.simBack = gl.getUniformLocation(simProg, 'u_back')
      U.blurDir = gl.getUniformLocation(blurProg, 'u_dir')
      U.blurExt = gl.getUniformLocation(blurProg, 'u_ext')
      U.blurTex = gl.getUniformLocation(blurProg, 'u_tex')
      U.blurRes = gl.getUniformLocation(blurProg, 'u_res')
      U.compScene = gl.getUniformLocation(compProg, 'u_scene')
      U.compGlow = gl.getUniformLocation(compProg, 'u_glow')

      programsReady = true
    }

    function makeFBO(): { fbo: WebGLFramebuffer; tex: WebGLTexture } | null {
      const fbo = gl.createFramebuffer()
      const tex = gl.createTexture()
      if (fbo === null || tex === null) return null
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      return { fbo, tex }
    }

    function createFBOs(): void {
      simA = makeFBO()
      simB = makeFBO()
      blurH = makeFBO()
      blurV = makeFBO()
    }

    function destroyFBO(entry: { fbo: WebGLFramebuffer; tex: WebGLTexture } | null): void {
      if (entry === null) return
      gl.deleteFramebuffer(entry.fbo)
      gl.deleteTexture(entry.tex)
    }

    function destroyFBOs(): void {
      destroyFBO(simA); simA = null
      destroyFBO(simB); simB = null
      destroyFBO(blurH); blurH = null
      destroyFBO(blurV); blurV = null
    }

    function destroyPrograms(): void {
      if (simProg !== null) gl.deleteProgram(simProg)
      if (blurProg !== null) gl.deleteProgram(blurProg)
      if (compProg !== null) gl.deleteProgram(compProg)
      if (vao !== null) gl.deleteVertexArray(vao)
      if (vbo !== null) gl.deleteBuffer(vbo)
      simProg = blurProg = compProg = null
      vao = null
      vbo = null
      programsReady = false
    }

    function resize(): void {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width || canvas.clientWidth || 132
      const h = rect.height || canvas.clientHeight || 30
      if (!w || !h) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      destroyFBOs()
      createFBOs()
    }

    function ensureLoop(): void {
      if (simA === null || simB === null) {
        resize()
        if (simA === null || simB === null) return
      }
      if (loopRunning) {
        idleFrames = 0
        return
      }
      loopRunning = true
      idleFrames = 0
      // 重新点火：elapsed 从 0 开始，火焰从滑块位置蔓延、渐强（原版动画）。
      startTime = performance.now()
      lastSpringTime = performance.now()
      springValue = sliderRef.current
      springVelocity = 0
      gl.bindFramebuffer(gl.FRAMEBUFFER, simA.fbo)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.bindFramebuffer(gl.FRAMEBUFFER, simB.fbo)
      gl.clear(gl.COLOR_BUFFER_BIT)
      rafId = requestAnimationFrame(render)
    }
    ensureLoopRef.current = ensureLoop

    function renderFrame(t: number): void {
      const now = performance.now()
      const dt = Math.min((now - lastSpringTime) / 1000, 0.05)
      lastSpringTime = now

      const target = sliderRef.current
      if (springValue < target) {
        const force = (target - springValue) * SPRING_STIFFNESS
        springVelocity += force * dt
        springVelocity *= 1 - SPRING_DAMP * dt * 6
        springValue += springVelocity * dt
        if (springValue > target) {
          springValue = target
          springVelocity = 0
        }
      } else {
        springValue = target
        springVelocity = 0
      }

      if (sliderRef.current <= 0 && !activeRef.current) {
        if (++idleFrames > MAX_IDLE) {
          loopRunning = false
          rafId = null
          return
        }
        return
      }
      idleFrames = 0

      const elapsed = startTime !== null ? (now - startTime) / 1000 : 0

      gl.viewport(0, 0, canvas.width, canvas.height)

      if (simB !== null && simProg !== null && blurProg !== null && compProg !== null
        && blurH !== null && blurV !== null && simA !== null) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, simB.fbo)
        gl.useProgram(simProg)
        gl.uniform1f(U.simTime, t * 0.001)
        gl.uniform1f(U.simSlider, springValue)
        gl.uniform1f(U.simElapsed, elapsed)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, simA.tex)
        gl.uniform1i(U.simBack, 0)
        gl.drawArrays(gl.TRIANGLES, 0, 6)

        gl.useProgram(blurProg)
        gl.uniform2f(U.blurRes, canvas.width, canvas.height)
        gl.bindFramebuffer(gl.FRAMEBUFFER, blurH.fbo)
        gl.uniform2f(U.blurDir, 1.0, 0.0)
        gl.uniform1f(U.blurExt, 1.0)
        gl.bindTexture(gl.TEXTURE_2D, simB.tex)
        gl.uniform1i(U.blurTex, 0)
        gl.drawArrays(gl.TRIANGLES, 0, 6)

        gl.bindFramebuffer(gl.FRAMEBUFFER, blurV.fbo)
        gl.uniform2f(U.blurDir, 0.0, 1.0)
        gl.uniform1f(U.blurExt, 0.0)
        gl.bindTexture(gl.TEXTURE_2D, blurH.tex)
        gl.drawArrays(gl.TRIANGLES, 0, 6)

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.useProgram(compProg)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, simB.tex)
        gl.uniform1i(U.compScene, 0)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, blurV.tex)
        gl.uniform1i(U.compGlow, 1)
        gl.drawArrays(gl.TRIANGLES, 0, 6)

        const tmp = simA
        simA = simB
        simB = tmp
      }
    }

    function render(t: number): void {
      renderFrame(t)
      if (loopRunning) rafId = requestAnimationFrame(render)
    }

    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)

    compilePrograms()
    if (programsReady) {
      console.log(`[aurora-effort] fire: gl ready (canvas ${canvas.clientWidth}x${canvas.clientHeight})`)
      resizeObserver = new ResizeObserver(() => {
        window.clearTimeout(resizeDebounce)
        resizeDebounce = window.setTimeout(resize, 80)
      })
      resizeObserver.observe(canvas)
      resize()
      console.log(`[aurora-effort] fire: buffer ${canvas.width}x${canvas.height}`)
      if (sliderRef.current > 0) ensureLoop()
      else console.warn('[aurora-effort] fire: skipped start, slider=0')
    } else {
      console.warn('[aurora-effort] fire: shader/program compile failed')
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      resizeObserver?.disconnect()
      window.clearTimeout(resizeDebounce)
      loopRunning = false
      destroyFBOs()
      destroyPrograms()
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      ensureLoopRef.current = null
    }
  }, [canvasRef])

  // Per-render kick: the first render of the panel usually has slider=0 (the
  // directory is still loading), so the mount-time check does not start the
  // loop. Once data lands, this effect starts (or keeps) the fire burning.
  useEffect(() => {
    if (sliderRef.current > 0) ensureLoopRef.current?.()
  })
}
