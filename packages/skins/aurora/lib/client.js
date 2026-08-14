window.__ModuleLoader__.load({
	id: "@captain1275/dsh-client-ui-skin-aurora",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_dom_client = require("react-dom/client");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/effort/shaders.ts
		/** WebGL2 fire shaders (ported from the reference effort-card demo). */
		const VERT = `#version 300 es
  layout(location=0) in vec2 a_pos;
  out vec2 v_uv;
  void main(){ v_uv=a_pos*0.5+0.5; gl_Position=vec4(a_pos,0.0,1.0); }
`;
		const FRAG_SIM = `#version 300 es
  precision highp float;
  in vec2 v_uv; out vec4 fc;
  uniform float u_time, u_slider, u_elapsed;
  uniform sampler2D u_back;
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  void main(){
    vec2 uv=v_uv;
    vec2 g=uv*vec2(72.0,6.0);
    vec2 id=floor(g);
    vec2 cf=fract(g);
    float h=hash(id);
    vec2 ap=abs(cf-0.5);
    float cell=smoothstep(0.34,0.22,max(ap.x*0.9,ap.y));
    vec3 prev=texture(u_back,uv).rgb;
    float fade_mask = smoothstep(0.0, 0.4, uv.x);
    vec3 decay = prev * 0.90 * fade_mask;
    float intensity = smoothstep(0.0, 0.2, u_slider) * mix(0.08, 1.0, pow(u_slider, 0.55));
    float t=u_time;
    float cellDelay = h * 1.2;
    float cellAge   = max(u_elapsed - cellDelay, 0.0);
    float ignited   = step(0.001, cellAge);
    float cellSpd   = 0.85 + h * 0.30;
    float eased = 1.0 - pow(1.0 - clamp(cellAge / 2.5, 0.0, 1.0), 3.0);
    float dist  = eased * u_slider * cellSpd * ignited;
    float cellOff = (h - 0.5) * 0.05;
    float front   = max(u_slider - dist - cellOff, 0.02);
    float tail    = max(u_slider - front, 0.001);
    float inZ   = step(front - 0.003, uv.x) * step(uv.x, u_slider + 0.003);
    float dn    = clamp(max(u_slider - uv.x, 0.0) / tail, 0.0, 1.0);
    float bright = pow(1.0 - dn, 0.65);
    bright = max(bright, 0.04 * ignited) * inZ;
    bright *= 1.0 - smoothstep(0.94, 1.05, dn);
    float es = mix(0.15, 0.5, min(u_elapsed / 1.0, 1.0));
    float vy = abs(uv.y - 0.5) * 2.0;
    float vf = pow(max(1.0 - vy * vy * 0.45, 0.0), 0.75);
    float ts = mix(0.85, 1.0, min(u_elapsed / 1.5, 1.0));
    float f1 = sin(uv.x * 30.0 + t * 15.0 * ts + h * 6.28);
    float f2 = sin(uv.x * 17.0 + t * 8.0 * ts + h * 3.14);
    float f3 = sin(uv.x * 52.0 + t * 25.0 * ts + h * 10.0);
    float flame = smoothstep(0.08, 0.92, (f1 + f2 * 0.5 + f3 * 0.25) * 0.35 + 0.5);
    float r1 = sin(dn * 16.0 - t * 5.0 * ts + h * 3.0);
    float r2 = sin(dn * 8.0 - t * 2.5 * ts + h * 5.0);
    float rhythm = smoothstep(-0.15, 0.55, r1) * (r2 * 0.5 + 0.5);
    rhythm = pow(max(rhythm, 0.0), 1.2);
    float avgSpd = dist / max(cellAge, 0.001);
    float age    = max(cellAge - max(u_slider - uv.x, 0.0) / max(avgSpd, 0.001), 0.0);
    float flash  = step(0.0, age) * exp(-age * 3.2);
    float sp  = fract(t * (0.38 + h * 0.15) + h * 7.0);
    float sX  = u_slider - sp * tail;
    float sY  = 0.5 + sin(sp * 11.0 + h * 6.28) * 0.28;
    float spark = smoothstep(0.014, 0.0, abs(uv.x - sX))
                * smoothstep(0.18, 0.0, abs(uv.y - sY))
                * (1.0 - sp) * (1.0 - sp) * es;
    float energy = bright * vf * (flame * 0.42 + rhythm * 0.38)
                 + flash * bright * vf * 0.55
                 + spark * 0.7 * inZ;
    energy *= es * intensity;
    float edgeBase = exp(-pow((uv.x - front) * 18.0, 2.0));
    float ef1 = sin(uv.x * 45.0 + t * 20.0 * ts + h * 6.28) * 0.5 + 0.5;
    float ef2 = sin(uv.x * 28.0 + t * 11.0 * ts + h * 3.14) * 0.5 + 0.5;
    float edge = edgeBase * (0.25 + ef1 * ef2 * 1.5) * 1.6 * intensity * es;
    float leadD    = front - uv.x;
    float leadZone = smoothstep(0.07, 0.0, leadD) * step(0.0, leadD) * vf;
    float h2       = hash(id + vec2(99.0, 33.0));
    float leadF    = sin(leadD * 100.0 + t * 20.0 * ts + h2 * 6.28) * 0.5 + 0.5;
    float leadSpark = leadZone * step(0.6, h2) * leadF * intensity * es * 0.5;
    float total = energy + edge + leadSpark;
    vec3 ember = vec3(0.28, 0.10, 0.58);
    vec3 wpur  = vec3(0.62, 0.32, 1.0);
    vec3 wht   = vec3(1.0, 0.94, 0.98);
    float temp = 1.0 - dn;
    vec3 col   = mix(ember, wpur, temp);
    col        = mix(col, wht, pow(temp, 4.5));
    col       *= total;
    float pulse = sin(t * 2.8) * 0.15 + 1.0;
    float core  = exp(-pow((uv.x - u_slider) * 16.0, 2.0));
    col += wht * core * 2.2 * pulse * intensity * es;
    col += wpur * exp(-pow((uv.x - u_slider) * 3.5, 2.0)) * 0.12 * intensity * es;
    col *= cell;
    col *= fade_mask;
    fc = vec4(min(decay + col, vec3(1.5)), 1.0);
  }
`;
		const FRAG_BLUR = `#version 300 es
  precision highp float;
  in vec2 v_uv; out vec4 fc;
  uniform sampler2D u_tex;
  uniform vec2 u_dir, u_res;
  uniform float u_ext;
  vec3 s(vec2 uv){
    vec3 c=texture(u_tex,uv).rgb;
    return u_ext>0.5 && dot(c,vec3(0.2126,0.7152,0.0722))<0.3 ? vec3(0.0) : c;
  }
  void main(){
    vec2 o=u_dir*1.8/u_res;
    vec3 r=s(v_uv)*0.227027;
    r+=s(v_uv+o)*0.194595;    r+=s(v_uv-o)*0.194595;
    r+=s(v_uv+o*2.0)*0.121622;r+=s(v_uv-o*2.0)*0.121622;
    r+=s(v_uv+o*3.0)*0.054054;r+=s(v_uv-o*3.0)*0.054054;
    fc=vec4(r,1.0);
  }
`;
		const FRAG_COMP = `#version 300 es
  precision highp float;
  in vec2 v_uv; out vec4 fc;
  uniform sampler2D u_scene, u_glow;
  void main(){
    vec3 s=texture(u_scene,v_uv).rgb;
    vec3 g=texture(u_glow,v_uv).rgb;
    fc=vec4(1.0-exp(-(s+g*1.2+s*g*0.35)*1.15),1.0);
  }
`;
		//#endregion
		//#region src/client/effort/useWebglFire.ts
		/**
		* WebGL2 fire effect for the effort slider track (ported from the reference
		* effort-card demo): a three-pass simulation (ignition -> blur -> composite)
		* whose front edge follows the slider value. React adaptation: the slider and
		* active flags are read through refs that render keeps fresh, so the effect
		* runs a single mount-time loop without re-initialising on value changes.
		*/
		/**
		* Start the fire loop on the given canvas.
		* @param canvasRef - the track canvas.
		* @param getSlider - returns the current slider position in 0..1.
		* @param getActive - whether the fire should burn (panel open).
		*/
		function useWebglFire(canvasRef, getSlider, getActive) {
			const sliderRef = (0, react.useRef)(0);
			const activeRef = (0, react.useRef)(false);
			sliderRef.current = getSlider();
			activeRef.current = getActive();
			const ensureLoopRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const canvas = canvasRef.current;
				if (canvas === null) {
					console.warn("[aurora-effort] fire: canvas not found");
					return;
				}
				const gl = canvas.getContext("webgl2", {
					preserveDrawingBuffer: false,
					antialias: false
				});
				if (gl === null) {
					console.warn("[aurora-effort] fire: webgl2 context unavailable (browser GPU/hardware acceleration off?)");
					return;
				}
				let rafId = null;
				let resizeObserver = null;
				let resizeDebounce;
				let loopRunning = false;
				let idleFrames = 0;
				let startTime = null;
				let springValue = .7;
				let springVelocity = 0;
				let lastSpringTime = 0;
				const MAX_IDLE = 180;
				const SPRING_STIFFNESS = 7;
				const SPRING_DAMP = .55;
				let simProg = null;
				let blurProg = null;
				let compProg = null;
				let vao = null;
				let vbo = null;
				let programsReady = false;
				let simA = null;
				let simB = null;
				let blurH = null;
				let blurV = null;
				const U = {};
				const onContextLost = (e) => e.preventDefault();
				const onContextRestored = () => {
					programsReady = false;
					compilePrograms();
					if (programsReady) {
						resize();
						if (sliderRef.current > 0) ensureLoop();
					}
				};
				function compileShader(type, src) {
					const sh = gl.createShader(type);
					if (sh === null) return null;
					gl.shaderSource(sh, src);
					gl.compileShader(sh);
					if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
						gl.deleteShader(sh);
						return null;
					}
					return sh;
				}
				function linkProgram(vsSrc, fsSrc) {
					const v = compileShader(gl.VERTEX_SHADER, vsSrc);
					const f = compileShader(gl.FRAGMENT_SHADER, fsSrc);
					if (v === null || f === null) return null;
					const p = gl.createProgram();
					if (p === null) return null;
					gl.attachShader(p, v);
					gl.attachShader(p, f);
					gl.bindAttribLocation(p, 0, "a_pos");
					gl.linkProgram(p);
					gl.deleteShader(v);
					gl.deleteShader(f);
					if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
					return p;
				}
				function compilePrograms() {
					simProg = linkProgram(VERT, FRAG_SIM);
					blurProg = linkProgram(VERT, FRAG_BLUR);
					compProg = linkProgram(VERT, FRAG_COMP);
					if (simProg === null || blurProg === null || compProg === null) return;
					vao = gl.createVertexArray();
					gl.bindVertexArray(vao);
					vbo = gl.createBuffer();
					gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
					gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
						-1,
						-1,
						1,
						-1,
						-1,
						1,
						-1,
						1,
						1,
						-1,
						1,
						1
					]), gl.STATIC_DRAW);
					gl.enableVertexAttribArray(0);
					gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
					U.simTime = gl.getUniformLocation(simProg, "u_time");
					U.simSlider = gl.getUniformLocation(simProg, "u_slider");
					U.simElapsed = gl.getUniformLocation(simProg, "u_elapsed");
					U.simBack = gl.getUniformLocation(simProg, "u_back");
					U.blurDir = gl.getUniformLocation(blurProg, "u_dir");
					U.blurExt = gl.getUniformLocation(blurProg, "u_ext");
					U.blurTex = gl.getUniformLocation(blurProg, "u_tex");
					U.blurRes = gl.getUniformLocation(blurProg, "u_res");
					U.compScene = gl.getUniformLocation(compProg, "u_scene");
					U.compGlow = gl.getUniformLocation(compProg, "u_glow");
					programsReady = true;
				}
				function makeFBO() {
					const fbo = gl.createFramebuffer();
					const tex = gl.createTexture();
					if (fbo === null || tex === null) return null;
					gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
					gl.bindTexture(gl.TEXTURE_2D, tex);
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
					gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
					gl.clearColor(0, 0, 0, 1);
					gl.clear(gl.COLOR_BUFFER_BIT);
					return {
						fbo,
						tex
					};
				}
				function createFBOs() {
					simA = makeFBO();
					simB = makeFBO();
					blurH = makeFBO();
					blurV = makeFBO();
				}
				function destroyFBO(entry) {
					if (entry === null) return;
					gl.deleteFramebuffer(entry.fbo);
					gl.deleteTexture(entry.tex);
				}
				function destroyFBOs() {
					destroyFBO(simA);
					simA = null;
					destroyFBO(simB);
					simB = null;
					destroyFBO(blurH);
					blurH = null;
					destroyFBO(blurV);
					blurV = null;
				}
				function destroyPrograms() {
					if (simProg !== null) gl.deleteProgram(simProg);
					if (blurProg !== null) gl.deleteProgram(blurProg);
					if (compProg !== null) gl.deleteProgram(compProg);
					if (vao !== null) gl.deleteVertexArray(vao);
					if (vbo !== null) gl.deleteBuffer(vbo);
					simProg = blurProg = compProg = null;
					vao = null;
					vbo = null;
					programsReady = false;
				}
				function resize() {
					const rect = canvas.getBoundingClientRect();
					const w = rect.width || canvas.clientWidth || 132;
					const h = rect.height || canvas.clientHeight || 30;
					if (!w || !h) return;
					const dpr = window.devicePixelRatio || 1;
					canvas.width = Math.round(w * dpr);
					canvas.height = Math.round(h * dpr);
					destroyFBOs();
					createFBOs();
				}
				function ensureLoop() {
					if (simA === null || simB === null) {
						resize();
						if (simA === null || simB === null) return;
					}
					if (loopRunning) {
						idleFrames = 0;
						return;
					}
					loopRunning = true;
					idleFrames = 0;
					startTime = performance.now();
					lastSpringTime = performance.now();
					springValue = sliderRef.current;
					springVelocity = 0;
					gl.bindFramebuffer(gl.FRAMEBUFFER, simA.fbo);
					gl.clear(gl.COLOR_BUFFER_BIT);
					gl.bindFramebuffer(gl.FRAMEBUFFER, simB.fbo);
					gl.clear(gl.COLOR_BUFFER_BIT);
					rafId = requestAnimationFrame(render);
				}
				ensureLoopRef.current = ensureLoop;
				function renderFrame(t) {
					const now = performance.now();
					const dt = Math.min((now - lastSpringTime) / 1e3, .05);
					lastSpringTime = now;
					const target = sliderRef.current;
					if (springValue < target) {
						const force = (target - springValue) * SPRING_STIFFNESS;
						springVelocity += force * dt;
						springVelocity *= 1 - SPRING_DAMP * dt * 6;
						springValue += springVelocity * dt;
						if (springValue > target) {
							springValue = target;
							springVelocity = 0;
						}
					} else {
						springValue = target;
						springVelocity = 0;
					}
					if (sliderRef.current <= 0 && !activeRef.current) {
						if (++idleFrames > MAX_IDLE) {
							loopRunning = false;
							rafId = null;
							return;
						}
						return;
					}
					idleFrames = 0;
					const elapsed = startTime !== null ? (now - startTime) / 1e3 : 0;
					gl.viewport(0, 0, canvas.width, canvas.height);
					if (simB !== null && simProg !== null && blurProg !== null && compProg !== null && blurH !== null && blurV !== null && simA !== null) {
						gl.bindFramebuffer(gl.FRAMEBUFFER, simB.fbo);
						gl.useProgram(simProg);
						gl.uniform1f(U.simTime, t * .001);
						gl.uniform1f(U.simSlider, springValue);
						gl.uniform1f(U.simElapsed, elapsed);
						gl.activeTexture(gl.TEXTURE0);
						gl.bindTexture(gl.TEXTURE_2D, simA.tex);
						gl.uniform1i(U.simBack, 0);
						gl.drawArrays(gl.TRIANGLES, 0, 6);
						gl.useProgram(blurProg);
						gl.uniform2f(U.blurRes, canvas.width, canvas.height);
						gl.bindFramebuffer(gl.FRAMEBUFFER, blurH.fbo);
						gl.uniform2f(U.blurDir, 1, 0);
						gl.uniform1f(U.blurExt, 1);
						gl.bindTexture(gl.TEXTURE_2D, simB.tex);
						gl.uniform1i(U.blurTex, 0);
						gl.drawArrays(gl.TRIANGLES, 0, 6);
						gl.bindFramebuffer(gl.FRAMEBUFFER, blurV.fbo);
						gl.uniform2f(U.blurDir, 0, 1);
						gl.uniform1f(U.blurExt, 0);
						gl.bindTexture(gl.TEXTURE_2D, blurH.tex);
						gl.drawArrays(gl.TRIANGLES, 0, 6);
						gl.bindFramebuffer(gl.FRAMEBUFFER, null);
						gl.useProgram(compProg);
						gl.activeTexture(gl.TEXTURE0);
						gl.bindTexture(gl.TEXTURE_2D, simB.tex);
						gl.uniform1i(U.compScene, 0);
						gl.activeTexture(gl.TEXTURE1);
						gl.bindTexture(gl.TEXTURE_2D, blurV.tex);
						gl.uniform1i(U.compGlow, 1);
						gl.drawArrays(gl.TRIANGLES, 0, 6);
						const tmp = simA;
						simA = simB;
						simB = tmp;
					}
				}
				function render(t) {
					renderFrame(t);
					if (loopRunning) rafId = requestAnimationFrame(render);
				}
				canvas.addEventListener("webglcontextlost", onContextLost);
				canvas.addEventListener("webglcontextrestored", onContextRestored);
				compilePrograms();
				if (programsReady) {
					console.log(`[aurora-effort] fire: gl ready (canvas ${canvas.clientWidth}x${canvas.clientHeight})`);
					resizeObserver = new ResizeObserver(() => {
						window.clearTimeout(resizeDebounce);
						resizeDebounce = window.setTimeout(resize, 80);
					});
					resizeObserver.observe(canvas);
					resize();
					console.log(`[aurora-effort] fire: buffer ${canvas.width}x${canvas.height}`);
					if (sliderRef.current > 0) ensureLoop();
					else console.warn("[aurora-effort] fire: skipped start, slider=0");
				} else console.warn("[aurora-effort] fire: shader/program compile failed");
				return () => {
					if (rafId !== null) cancelAnimationFrame(rafId);
					resizeObserver?.disconnect();
					window.clearTimeout(resizeDebounce);
					loopRunning = false;
					destroyFBOs();
					destroyPrograms();
					canvas.removeEventListener("webglcontextlost", onContextLost);
					canvas.removeEventListener("webglcontextrestored", onContextRestored);
					ensureLoopRef.current = null;
				};
			}, [canvasRef]);
			(0, react.useEffect)(() => {
				if (sliderRef.current > 0) ensureLoopRef.current?.();
			});
		}
		//#endregion
		//#region \0dsh-css:D:\Desktop\DeepSeek Harness\dsh-web-ui-0.1.10\packages\skins\aurora\src\client\effort\effort.module.css.mjs
		const css$1 = ".fgSaaq_panel{user-select:none;z-index:10;pointer-events:auto;width:280px;position:absolute;top:0;left:0}.fgSaaq_glow{opacity:.6;filter:blur(8px);z-index:0;pointer-events:none;background:linear-gradient(135deg,#a855f74d,#3b82f626,#a855f733);border-radius:18px;position:absolute;inset:-3px}.fgSaaq_inner{z-index:1;background:linear-gradient(160deg,#0e0a16 0%,#140e20 50%,#0c0818 100%);border:1px solid #a855f71f;border-radius:13px;padding:14px 16px 12px;position:relative;box-shadow:0 8px 32px #00000080,inset 0 1px #ffffff0a}.fgSaaq_head{justify-content:space-between;align-items:center;margin-bottom:2px;display:flex}.fgSaaq_headLeft{align-items:center;gap:7px;font-size:14px;font-weight:500;display:inline-flex;overflow:hidden}.fgSaaq_labelText{color:#8880a0;letter-spacing:.03em;font-weight:600}.fgSaaq_status{color:#aaa0c0;text-transform:uppercase;will-change:transform, opacity, filter;vertical-align:middle;font-family:Georgia,Palatino Linotype,serif;font-style:italic;font-weight:700;transition:color .4s cubic-bezier(.25,.46,.45,.94),text-shadow .4s cubic-bezier(.25,.46,.45,.94);display:inline-block}.fgSaaq_statusGlow{color:#c084fc;text-shadow:0 0 14px #a855f7b3}.fgSaaq_level0{color:#c882a0bf}.fgSaaq_level1{color:#c8aa82bf}.fgSaaq_level2{color:#82aac8bf}.fgSaaq_level3{color:#c084fcf2;text-shadow:0 0 10px #a855f7b3}.fgSaaq_level4{color:#d8b4fe;text-shadow:0 0 12px #a855f7}.fgSaaq_close{color:#8880a0;cursor:pointer;background:#a855f714;border:1px solid #a855f72e;border-radius:7px;justify-content:center;align-items:center;width:24px;height:24px;font-size:13px;line-height:1;display:inline-flex}.fgSaaq_close:hover{color:#e8e0f0;background:#a855f729;border-color:#a855f766}.fgSaaq_levelLabels{height:15px;margin-bottom:4px;position:relative}.fgSaaq_levelLabel{color:#6a6080;letter-spacing:.04em;text-transform:uppercase;font-size:10px;font-weight:700;transition:color .15s;position:absolute;top:0;transform:translate(-50%)}.fgSaaq_levelLabelActive{color:#c084fc}.fgSaaq_trackWrapper{isolation:isolate;background:#08050e;border:1px solid #a855f714;border-radius:8px;height:32px;position:relative;overflow:hidden}.fgSaaq_trackBg{z-index:0;background:linear-gradient(135deg,#0c0518,#06030c);position:absolute;inset:0}.fgSaaq_dotsLayer{pointer-events:none;z-index:1;position:absolute;inset:0}.fgSaaq_dot{background:#a855f740;border-radius:50%;width:4px;height:4px;transition:background .15s,box-shadow .15s;position:absolute;top:50%;transform:translateY(-50%)}.fgSaaq_dotActive{background:#c084fc;box-shadow:0 0 8px #a855f7e6}.fgSaaq_fire{pointer-events:none;mix-blend-mode:screen;z-index:2;width:100%;height:100%;position:absolute;inset:0}.fgSaaq_range{-webkit-appearance:none;appearance:none;cursor:pointer;z-index:5;background:0 0;outline:none;width:100%;height:100%;margin:0;padding:0;position:absolute;inset:0}.fgSaaq_range::-webkit-slider-thumb{-webkit-appearance:none;cursor:grab;background:linear-gradient(145deg,#e8e0f0 0%,#c8b8e0 50%,#b8a8d8 100%);border:none;border-radius:8px;width:28px;height:28px;transition:box-shadow .5s cubic-bezier(.25,.46,.45,.94),transform .35s cubic-bezier(.34,1.56,.64,1);box-shadow:0 2px 8px #0006,0 0 0 1px #a855f726,inset 0 1px #ffffff80}.fgSaaq_range::-webkit-slider-thumb:active{cursor:grabbing;transform:scale(.92);box-shadow:0 1px 4px #00000080,0 0 0 1px #a855f740}.fgSaaq_rangeGlow::-webkit-slider-thumb{box-shadow:0 2px 8px #0006,0 0 0 1px #a855f74d,0 0 20px #a855f759,0 0 40px #a855f726,inset 0 1px #ffffff80}.fgSaaq_rangeGlow::-webkit-slider-thumb:active{box-shadow:0 1px 4px #00000080,0 0 0 1px #a855f766,0 0 24px #a855f766,0 0 48px #a855f733}.fgSaaq_range::-moz-range-thumb{cursor:grab;background:linear-gradient(145deg,#e8e0f0 0%,#c8b8e0 50%,#b8a8d8 100%);border:none;border-radius:7px;width:26px;height:26px;box-shadow:0 2px 8px #0006,0 0 0 1px #a855f726}.fgSaaq_range::-moz-range-thumb:active{cursor:grabbing;transform:scale(.95)}.fgSaaq_range::-moz-range-track{background:0 0;border:none;height:32px}.fgSaaq_pointLight{pointer-events:none;z-index:3;opacity:0;background:radial-gradient(circle,#a855f733 0%,#a855f70f 30%,#a855f704 55%,#0000 70%);border-radius:50%;width:150px;height:150px;transition:opacity .25s cubic-bezier(.25,.46,.45,.94);position:absolute;transform:translate(-50%,-50%)}.fgSaaq_pointLightOn{opacity:1}.fgSaaq_emptyOverlay{color:#6a6080;letter-spacing:.02em;text-align:center;padding:10px 0 2px;font-size:13px;font-weight:600}.fgSaaq_statusEnterActive{transition:all .4s cubic-bezier(.25,.46,.45,.94)}.fgSaaq_statusEnterFrom{opacity:0;filter:blur(10px);transform:translateY(8px)}";
		const tagId$1 = "@captain1275/dsh-client-ui-skin-aurora/effort.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-client-ui-skin-aurora";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var effort_module_css_default = {
			"close": "fgSaaq_close",
			"dot": "fgSaaq_dot",
			"dotActive": "fgSaaq_dotActive",
			"dotsLayer": "fgSaaq_dotsLayer",
			"emptyOverlay": "fgSaaq_emptyOverlay",
			"fire": "fgSaaq_fire",
			"glow": "fgSaaq_glow",
			"head": "fgSaaq_head",
			"headLeft": "fgSaaq_headLeft",
			"inner": "fgSaaq_inner",
			"labelText": "fgSaaq_labelText",
			"level0": "fgSaaq_level0",
			"level1": "fgSaaq_level1",
			"level2": "fgSaaq_level2",
			"level3": "fgSaaq_level3",
			"level4": "fgSaaq_level4",
			"levelLabel": "fgSaaq_levelLabel",
			"levelLabelActive": "fgSaaq_levelLabelActive",
			"levelLabels": "fgSaaq_levelLabels",
			"panel": "fgSaaq_panel",
			"pointLight": "fgSaaq_pointLight",
			"pointLightOn": "fgSaaq_pointLightOn",
			"range": "fgSaaq_range",
			"rangeGlow": "fgSaaq_rangeGlow",
			"status": "fgSaaq_status",
			"statusEnterActive": "fgSaaq_statusEnterActive",
			"statusEnterFrom": "fgSaaq_statusEnterFrom",
			"statusGlow": "fgSaaq_statusGlow",
			"trackBg": "fgSaaq_trackBg",
			"trackWrapper": "fgSaaq_trackWrapper"
		};
		//#endregion
		//#region src/client/effort/EffortPanel.tsx
		/**
		* aurora Effort panel — 1:1 port of the reference EffortCard (glow border,
		* gradient card, Easy/Intense scale labels, WebGL fire track, glowing thumb,
		* drag point-light). Clicking the「推理等级」row in the official model menu
		* opens this panel instead of the level list; the slider is continuous while
		* dragging and snaps to the nearest effort level on release.
		*/
		/** Panel width (must match the CSS `.panel` width). */
		const PANEL_W = 280;
		/** Load the per-session model directory once per panel open. */
		function useDirectory(connection, sessionId) {
			const [directory, setDirectory] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				setDirectory(null);
				connection.api.sessions.models({ sessionId }).then((response) => {
					const value = response.result.ok ? response.result.value : null;
					console.log("[aurora-effort] models:", response.result.ok ? `ok groups=${value?.groups?.length} current=${JSON.stringify(value?.current)}` : `fail ${response.result.error?.code}: ${response.result.error?.message}`);
					if (alive && response.result.ok) setDirectory(response.result.value);
				}).catch((error) => {
					console.warn("[aurora-effort] models threw:", error);
				});
				return () => {
					alive = false;
				};
			}, [connection, sessionId]);
			return directory;
		}
		/**
		* The floating effort card.
		* @param props - session + wire face + close verb.
		*/
		function EffortPanel(props) {
			const { sessionId, connection, onClose } = props;
			const directory = useDirectory(connection, sessionId);
			const [dragging, setDragging] = (0, react.useState)(false);
			const [rawValue, setRawValue] = (0, react.useState)(0);
			const disabled = directory === null;
			const rawCurrent = directory?.current ?? null;
			const fallback = directory !== null && directory.groups.length > 0 && directory.groups[0].models.length > 0 ? {
				provider: directory.groups[0].id,
				model: directory.groups[0].models[0].id
			} : null;
			const current = rawCurrent ?? fallback;
			const model = (current === null ? void 0 : directory?.groups.find((entry) => entry.id === current.provider))?.models.find((entry) => entry.id === current?.model);
			const efforts = model?.reasoning?.efforts ?? [];
			const usable = !disabled && current !== null && efforts.length >= 2;
			const currentEffortId = current?.reasoningEffort ?? model?.reasoning?.defaultEffort;
			const rawIndex = currentEffortId === void 0 ? -1 : efforts.findIndex((level) => level.id === currentEffortId);
			const step100 = efforts.length > 1 ? 100 / (efforts.length - 1) : 100;
			const initialRaw = usable && rawIndex >= 0 ? rawIndex * step100 : 0;
			(0, react.useEffect)(() => {
				setRawValue(initialRaw);
				setDragging(false);
			}, [directory]);
			const displayIndex = usable ? Math.round(rawValue / step100) : 0;
			const level = efforts[displayIndex];
			const slider100 = usable ? rawValue : 0;
			const slider01 = usable ? .15 + rawValue / 100 * .85 : 0;
			const fireRef = (0, react.useRef)(null);
			useWebglFire(fireRef, () => slider01, () => true);
			const maskP = Math.max(slider100 - 1.5, 0);
			const maskFade = Math.min(slider100 + 1.5, 100);
			const fireStyle = usable ? {
				maskImage: `linear-gradient(to right, black 0%, black ${maskP}%, transparent ${maskFade}%)`,
				WebkitMaskImage: `linear-gradient(to right, black 0%, black ${maskP}%, transparent ${maskFade}%)`,
				opacity: 1
			} : { opacity: 0 };
			const pointLightStyle = {
				left: `${22 + slider100 / 100 * (PANEL_W - 44)}px`,
				top: "76px"
			};
			/** 写入当前档位到会话（供拖动中节流调用）。 */
			const writeEffort = (v) => {
				if (!usable || current === null) return;
				const idx = Math.round(v / step100);
				const effort = efforts[idx];
				if (effort === void 0) return;
				connection.api.sessions.selectModel({
					sessionId,
					provider: current.provider,
					model: current.model,
					reasoningEffort: effort.id
				}).catch(() => {});
			};
			const lastWriteRef = (0, react.useRef)(0);
			const onInput = (event) => {
				if (!usable) return;
				const v = Number(event.target.value);
				setRawValue(v);
				const now = performance.now();
				if (now - lastWriteRef.current >= 16) {
					lastWriteRef.current = now;
					writeEffort(v);
				}
			};
			/** 松手/失焦/键盘结束时吸附到最近档位并补发一次确认。 */
			const commit = (event) => {
				if (!usable) return;
				const v = Number(event.target.value);
				const idx = Math.round(v / step100);
				setRawValue(idx * step100);
				setDragging(false);
				writeEffort(v);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: effort_module_css_default.panel,
				"data-effort-panel": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: effort_module_css_default.glow }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: effort_module_css_default.inner,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: effort_module_css_default.head,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: effort_module_css_default.headLeft,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: effort_module_css_default.labelText,
									children: "Effort"
								}), usable && level !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: `${effort_module_css_default.status} ${effort_module_css_default[`level${displayIndex}`] ?? ""} ${displayIndex === efforts.length - 1 ? effort_module_css_default.statusGlow : ""}`,
									children: level.name
								}, level.name) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: effort_module_css_default.status,
									children: "—"
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: effort_module_css_default.close,
								onClick: onClose,
								"aria-label": "关闭",
								children: "×"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: effort_module_css_default.levelLabels,
							children: efforts.map((entry, labelIndex) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: `${effort_module_css_default.levelLabel}${labelIndex === displayIndex ? ` ${effort_module_css_default.levelLabelActive}` : ""}`,
								style: { left: `${10 + labelIndex / Math.max(efforts.length - 1, 1) * 80}%` },
								children: labelIndex === 0 ? "OFF" : labelIndex === efforts.length - 1 ? "MAX" : entry.name
							}, entry.id))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: effort_module_css_default.trackWrapper,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: effort_module_css_default.trackBg }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: effort_module_css_default.dotsLayer,
									children: efforts.map((_, dotIndex) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `${effort_module_css_default.dot}${dotIndex === displayIndex ? ` ${effort_module_css_default.dotActive}` : ""}`,
										style: { left: `${10 + dotIndex / Math.max(efforts.length - 1, 1) * 80}%` }
									}, dotIndex))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("canvas", {
									ref: fireRef,
									className: effort_module_css_default.fire,
									style: fireStyle
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: `${effort_module_css_default.pointLight}${dragging ? ` ${effort_module_css_default.pointLightOn}` : ""}`,
									style: pointLightStyle
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "range",
									min: 0,
									max: 100,
									step: 1,
									value: usable ? rawValue : 0,
									disabled: !usable,
									className: `${effort_module_css_default.range}${dragging ? ` ${effort_module_css_default.rangeGlow}` : ""}`,
									onInput,
									onPointerDown: () => setDragging(true),
									onPointerUp: commit,
									onPointerLeave: () => setDragging(false),
									onBlur: commit
								})
							]
						}),
						!usable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: effort_module_css_default.emptyOverlay,
							children: disabled ? "模型目录加载中…" : "当前模型不提供多档推理等级"
						})
					]
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:D:\Desktop\DeepSeek Harness\dsh-web-ui-0.1.10\packages\skins\aurora\src\client\aurora.module.css.mjs
		const css = "body[data-dsh-aurora]{--dsw-alias-bg-base:#05081a47;--dsw-specific-sidebar-fill:#05081a59;--dsw-specific-input-major:#080a166b;--dsw-specific-sidebar-nav-item-hover:#ffffff14;--dsw-specific-sidebar-nav-item-active:#7aa2ff2e;--dsw-alias-bg-layer-1:#0a0c1899;--dsw-alias-bg-layer-2:#0e112085;--dsw-alias-bg-layer-3:#12162873;--dsw-alias-bg-overlay:#03040a8c;--dsw-alias-bg-mask-1:#03040a6b;--dsw-alias-fill-l2:#ffffff0d;--dsw-alias-interactive-bg-hover:#7aa2ff1f;--dsw-alias-interactive-bg-primary:#7aa2ff33;--dsw-alias-border-l1:#8ca0ff24;--dsw-alias-border-l2:#8ca0ff38;--dsw-alias-label-primary:#eef1ff;--dsw-alias-label-secondary:#b9c2e8;--dsw-alias-label-tertiary:#8b95c4;--dsw-alias-label-error:#ff7a8a;--dsw-alias-brand-primary:#7aa2ff;--dsw-alias-button-primary-fill:#4f6ef7;--dsw-alias-button-primary-hover:#3d5be0}body[data-dsh-aurora]:not([data-ds-dark-theme]){--dsw-alias-bg-base:#fafcff52;--dsw-specific-sidebar-fill:#fafcff66;--dsw-specific-input-major:#fafcff80;--dsw-specific-sidebar-nav-item-hover:#0f142d0f;--dsw-specific-sidebar-nav-item-active:#3b5bd824;--dsw-alias-bg-layer-1:#fff9;--dsw-alias-bg-layer-2:#ffffff80;--dsw-alias-bg-layer-3:#ffffff6b;--dsw-alias-bg-overlay:#fafcff99;--dsw-alias-bg-mask-1:#fafcff8c;--dsw-alias-fill-l2:#0f142d0d;--dsw-alias-interactive-bg-hover:#3b5bd81a;--dsw-alias-interactive-bg-primary:#3b5bd829;--dsw-alias-border-l1:#141e501f;--dsw-alias-border-l2:#141e5033;--dsw-alias-label-primary:#232842;--dsw-alias-label-secondary:#5a6180;--dsw-alias-label-tertiary:#8b92ad;--dsw-alias-label-error:#c62828;--dsw-alias-brand-primary:#3b5bd8;--dsw-alias-button-primary-fill:#3b5bd8;--dsw-alias-button-primary-hover:#2f4ac4}body[data-dsh-aurora][data-ds-dark-theme]{--aion-bg-base:#05081a4d;--aion-bg-1:#05081a59;--aion-bg-2:#05081a4d;--aion-bg-3:#8ca0ff29;--aion-bg-hover:#ffffff0f;--aion-bg-active:#ffffff1a;--aion-fill-2:#ffffff0f;--aion-fill-3:#ffffff1a;--aion-border-base:#8ca0ff29}body[data-dsh-aurora]:not([data-ds-dark-theme]){--aion-bg-base:#fafcff59;--aion-bg-1:#fafcff66;--aion-bg-2:#fafcff59;--aion-bg-3:#141e501f;--aion-bg-hover:#0f142d0f;--aion-bg-active:#0f142d1a;--aion-fill-2:#0f142d0d;--aion-fill-3:#0f142d14;--aion-border-base:#141e5024}.-nPTLq_auroraBackdrop{z-index:-1;pointer-events:none;background-position:50%;background-repeat:no-repeat;background-size:cover;background-attachment:fixed;position:fixed;inset:0}body[data-dsh-aurora] [data-dsh-taskboard-entry],body[data-dsh-aurora] [data-dsh-ssh-entry]{margin-top:4px;background:0 0!important}body[data-dsh-aurora] [data-dsh-taskboard-entry]+[data-dsh-ssh-entry],body[data-dsh-aurora] [data-dsh-ssh-entry]+[data-dsh-taskboard-entry]{margin-top:6px}body[data-dsh-aurora] button[class*=newSession]{border-color:var(--dsw-alias-border-l2);background:0 0}body[data-dsh-aurora] button[class*=newSession]:hover{background:var(--dsw-alias-interactive-bg-hover)}body[data-dsh-aurora] [data-composer-card]{-webkit-backdrop-filter:blur(30px);background:#1019266b;border:1px solid #ffffff14;box-shadow:0 8px 32px #0000004d,inset 0 1px #ffffff0f}body[data-dsh-aurora]:not([data-ds-dark-theme]) [data-composer-card]{-webkit-backdrop-filter:blur(30px);background:#ffffff73;border:1px solid #fff9;box-shadow:0 8px 32px #141e5024,inset 0 1px #fffc}body[data-dsh-aurora] [class*=triggerEffort]:before{content:\"· \";margin-right:1px}body[data-dsh-aurora] [class*=triggerEffort]{color:var(--dsw-alias-label-secondary,#b9c2e8);font-weight:600}body[data-dsh-aurora] [class*=userRow] [class*=bubble]{-webkit-backdrop-filter:blur(14px);background:#5e7cff3d;border:1px solid #8ca0ff2e}body[data-dsh-aurora]:not([data-ds-dark-theme]) [class*=userRow] [class*=bubble]{background:#ffffff6b;border:1px solid #141e5024}.-nPTLq_auroraCard{flex-direction:column;gap:8px;padding:2px 0;display:flex}.-nPTLq_auroraCardHead{justify-content:space-between;align-items:center;gap:10px;display:flex}.-nPTLq_auroraCardTitle{color:var(--dsw-alias-label-primary,#eee);font-size:14px;font-weight:600}.-nPTLq_auroraCardDesc{color:var(--dsw-alias-label-tertiary,#888);margin:0;font-size:12px}.-nPTLq_auroraCardBody{flex-direction:column;gap:8px;display:flex}.-nPTLq_auroraField{color:var(--dsw-alias-label-secondary,#999);flex-direction:column;gap:3px;font-size:12px;display:flex}.-nPTLq_auroraField input[type=text]{border:1px solid var(--dsw-alias-border-l2,#80808059);background:var(--dsw-alias-bg-layer-2,#80808026);color:var(--dsw-alias-label-primary,#eee);border-radius:6px;padding:4px 8px;font-size:12px}.-nPTLq_auroraField input[type=range]{accent-color:var(--dsw-alias-brand-primary,#7aa2ff)}.-nPTLq_auroraSwitch{background:var(--dsw-alias-fill-l2,#333);cursor:pointer;border:0;border-radius:999px;flex:none;width:34px;height:18px;padding:0;transition:background .15s;position:relative}.-nPTLq_auroraSwitchOn{background:var(--dsw-alias-brand-primary,#7aa2ff)}.-nPTLq_auroraSwitchThumb{background:#fff;border-radius:50%;width:14px;height:14px;transition:transform .15s;position:absolute;top:2px;left:2px}.-nPTLq_auroraSwitchOn .-nPTLq_auroraSwitchThumb{transform:translate(16px)}.-nPTLq_auroraLocal{align-items:center;gap:8px;font-size:12px;display:flex}.-nPTLq_auroraLocalLabel{color:var(--dsw-alias-label-secondary,#999)}.-nPTLq_auroraLocalThumb{border:1px solid var(--dsw-alias-border-l2,#80808059);background-position:50%;background-size:cover;border-radius:6px;flex:none;width:64px;height:36px}.-nPTLq_auroraBtn{border:1px solid var(--dsw-alias-border-l2,#80808059);background:var(--dsw-alias-bg-layer-2,#80808026);color:var(--dsw-alias-label-secondary,#bbb);cursor:pointer;border-radius:6px;padding:4px 10px;font-size:12px}.-nPTLq_auroraBtn:hover{background:var(--dsw-alias-interactive-bg-hover,#80808033);color:var(--dsw-alias-label-primary,#eee)}";
		const tagId = "@captain1275/dsh-client-ui-skin-aurora/aurora.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-client-ui-skin-aurora";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var aurora_module_css_default = {
			"auroraBackdrop": "-nPTLq_auroraBackdrop",
			"auroraBtn": "-nPTLq_auroraBtn",
			"auroraCard": "-nPTLq_auroraCard",
			"auroraCardBody": "-nPTLq_auroraCardBody",
			"auroraCardDesc": "-nPTLq_auroraCardDesc",
			"auroraCardHead": "-nPTLq_auroraCardHead",
			"auroraCardTitle": "-nPTLq_auroraCardTitle",
			"auroraField": "-nPTLq_auroraField",
			"auroraLocal": "-nPTLq_auroraLocal",
			"auroraLocalLabel": "-nPTLq_auroraLocalLabel",
			"auroraLocalThumb": "-nPTLq_auroraLocalThumb",
			"auroraSwitch": "-nPTLq_auroraSwitch",
			"auroraSwitchOn": "-nPTLq_auroraSwitchOn",
			"auroraSwitchThumb": "-nPTLq_auroraSwitchThumb"
		};
		//#endregion
		//#region src/client/index.ts
		/** 需要的客户端服务：connection（模型目录读写）、sessions（当前会话）。 */
		const inject = ["connection", "sessions"];
		/** 配置变更事件（皮肤中心卡片写入后派发，本半区监听重绘）。 */
		const AURORA_EVENT = "dshc-aurora-config";
		const DEFAULTS = {
			enabled: true,
			backgroundUrl: "",
			opacity: .8,
			blur: 0
		};
		let cached = { ...DEFAULTS };
		/** 从宿主路由拉取最新配置（失败时沿用缓存）。 */
		async function fetchConfig() {
			try {
				const data = await (await fetch("/api/skin-aurora/config")).json();
				if (data?.ok === true && data.config !== void 0) cached = {
					enabled: typeof data.config.enabled === "boolean" ? data.config.enabled : DEFAULTS.enabled,
					backgroundUrl: typeof data.config.backgroundUrl === "string" ? data.config.backgroundUrl : DEFAULTS.backgroundUrl,
					opacity: typeof data.config.opacity === "number" ? data.config.opacity : DEFAULTS.opacity,
					blur: typeof data.config.blur === "number" ? data.config.blur : DEFAULTS.blur
				};
			} catch {}
			return cached;
		}
		/** 解析一个模块类名（css-modules 记录按字面量名索引）。 */
		const cls = (name) => aurora_module_css_default[name] ?? "";
		function cssEscape(url) {
			return url.replace(/["\\]/g, "\\$&");
		}
		/** 深色极光渐变（深色模式默认背景）。 */
		function auroraGradient(dark) {
			return dark ? [
				"radial-gradient(1200px 800px at 15% 8%, rgba(90,120,255,0.38), transparent 60%)",
				"radial-gradient(1000px 700px at 85% 18%, rgba(0,200,180,0.24), transparent 55%)",
				"radial-gradient(900px 900px at 60% 100%, rgba(160,80,255,0.26), transparent 60%)",
				"linear-gradient(180deg, #05081a 0%, #0a1030 55%, #0d0a26 100%)"
			].join(",") : [
				"radial-gradient(1200px 800px at 15% 8%, rgba(90,130,255,0.30), transparent 60%)",
				"radial-gradient(1000px 700px at 85% 18%, rgba(0,180,170,0.20), transparent 55%)",
				"radial-gradient(900px 900px at 60% 100%, rgba(150,90,255,0.22), transparent 60%)",
				"linear-gradient(180deg, #f2f5ff 0%, #e4ebfb 55%, #ece7fb 100%)"
			].join(",");
		}
		/**
		* 应用 aurora 皮肤：body 属性 + 自定义背景层（配置驱动，经路由读取、事件联动）。
		* 所有写入由 ctx.effect 的 disposer 在卸载时回收。
		* @param ctx - 宿主上下文（effect 生命周期负责回收）。
		*/
		function apply(ctx) {
			const body = document.body;
			body.dataset.dshAurora = "";
			let backdrop = null;
			const renderBackdrop = (cfg) => {
				backdrop?.remove();
				backdrop = null;
				if (!cfg.enabled) return;
				const dark = body.dataset.dsDarkTheme !== void 0;
				const layer = document.createElement("div");
				layer.className = cls("auroraBackdrop");
				layer.style.backgroundImage = cfg.backgroundUrl ? `url("${cssEscape(cfg.backgroundUrl)}")` : auroraGradient(dark);
				layer.style.opacity = String(cfg.opacity);
				layer.style.filter = cfg.blur > 0 ? `blur(${cfg.blur}px)` : "none";
				body.appendChild(layer);
				backdrop = layer;
			};
			const refresh = () => {
				fetchConfig().then((cfg) => renderBackdrop(cfg));
			};
			const onConfig = () => refresh();
			window.addEventListener(AURORA_EVENT, onConfig);
			const observer = new MutationObserver(refresh);
			observer.observe(body, {
				attributes: true,
				attributeFilter: ["data-ds-dark-theme"]
			});
			refresh();
			const host = document.createElement("div");
			host.dataset.auroraEffortHost = "";
			host.style.cssText = "position: fixed; z-index: 10000; top: 0; left: 0; width: 0; height: 0; pointer-events: none;";
			body.appendChild(host);
			let root = null;
			const hidePanel = () => {
				root?.unmount();
				root = null;
			};
			const showPanel = (sessionId, anchor) => {
				const rect = anchor.getBoundingClientRect();
				const PANEL_W = 280;
				const PANEL_H = 150;
				const left = Math.max(8, Math.min(rect.right - PANEL_W, window.innerWidth - PANEL_W - 8));
				const top = window.innerHeight - rect.bottom >= 166 ? rect.bottom + 8 : Math.max(8, rect.top - PANEL_H - 8);
				host.style.left = `${left}px`;
				host.style.top = `${top}px`;
				if (root === null) root = (0, react_dom_client.createRoot)(host);
				root.render((0, react.createElement)(EffortPanel, {
					sessionId,
					connection: ctx.get("connection"),
					onClose: hidePanel
				}));
			};
			const onDocClick = (event) => {
				const target = event.target;
				if (host.contains(target)) return;
				const row = target.closest?.("button[role=\"menuitem\"]");
				if (row instanceof HTMLElement) {
					const text = (row.textContent ?? "").trim();
					if (text.startsWith("推理等级") || text.startsWith("Effort")) {
						console.log("[aurora-effort] intercept row:", JSON.stringify(text));
						event.preventDefault();
						event.stopPropagation();
						const current = ctx.get("sessions").list.getSnapshot().current;
						console.log("[aurora-effort] session:", current);
						if (current !== void 0) showPanel(current, row);
						else console.warn("[aurora-effort] no session id");
						return;
					}
				}
				if (!host.contains(target)) hidePanel();
			};
			document.addEventListener("click", onDocClick, true);
			ctx.effect(() => () => {
				delete body.dataset.dshAurora;
				observer.disconnect();
				window.removeEventListener(AURORA_EVENT, onConfig);
				document.removeEventListener("click", onDocClick, true);
				hidePanel();
				host.remove();
				backdrop?.remove();
				backdrop = null;
			}, "ui-skin-aurora: backdrop + effort panel");
		}
		//#endregion
		exports.AURORA_EVENT = AURORA_EVENT;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map