// Refract only the harbour's water. All masonry, boats and typography retain the source pixels.
const vertex = `#version 300 es
in vec2 point;
void main(){ gl_Position=vec4(point,0.,1.); }`;
const fragment = `#version 300 es
precision highp float;
uniform sampler2D city;
uniform vec2 box, artwork;
uniform float look, time, pulse;
uniform vec2 touch;
out vec4 shade;
void main(){
  vec2 screen=vec2(gl_FragCoord.x/box.x,1.-gl_FragCoord.y/box.y);
  float fit=max(box.x/artwork.x,box.y/artwork.y);
  vec2 scaled=artwork*fit;
  vec2 uv=(screen*box-(box-scaled)*vec2(look,.49))/scaled;
  float shore=smoothstep(.725,.80,uv.y)*smoothstep(.25,.39,uv.x)*(1.-smoothstep(.88,.95,uv.x));
  float sill=.98-.19*pow(max(0.,(.30-uv.x)/.30),1.35);
  shore*=1.-smoothstep(sill-.035,sill,uv.y);
  if(shore<.012)discard;
  float depth=max(0.,uv.y-.715);
  float wave=sin(uv.y*410.-time*1.55+sin(uv.x*26.+time*.31))+.42*sin(uv.y*810.+time*1.04);
  vec2 d=(uv-touch)*vec2(1.78,1.);
  float r=length(d);
  float ripple=sin((r-pulse*.13)*178.)*exp(-17.*abs(r-pulse*.13))*exp(-1.3*pulse);
  vec2 bend=vec2(wave*.0013*depth/.26, wave*.0009+ripple*.0018);
  vec3 reflection=texture(city,clamp(uv+bend*shore,0.,1.)).rgb;
  shade=vec4(reflection,shore*.90);
}`;
export function mountHarbourReflection(canvas: HTMLCanvasElement, photo: HTMLImageElement, holder: HTMLElement) {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches)
        return () => { };
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, preserveDrawingBuffer: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl)
        return () => { };
    const resources: WebGLShader[] = [];
    function compile(type: number, code: string) {
        const sh = gl!.createShader(type);
        if (!sh)
            return null;
        resources.push(sh);
        gl!.shaderSource(sh, code);
        gl!.compileShader(sh);
        return gl!.getShaderParameter(sh, gl!.COMPILE_STATUS) ? sh : null;
    }
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment), program = gl.createProgram();
    function free() { resources.forEach(s => gl!.deleteShader(s)); if (program)
        gl!.deleteProgram(program); }
    if (!vs || !fs || !program) {
        free();
        return () => { };
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        free();
        return () => { };
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer(), texture = gl.createTexture();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(program, 'point');
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const u = (name: string) => gl.getUniformLocation(program, name);
    const uniforms = { box: u('box'), art: u('artwork'), look: u('look'), time: u('time'), pulse: u('pulse'), touch: u('touch') };
    let frame = 0, timer = 0, visible = false, ready = false, lastPulse = -9000, px = .52, py = .81, closed = false, draws = 0;
    function resize() {
        const b = canvas!.getBoundingClientRect(), max = matchMedia('(pointer:coarse)').matches ? 720 : 1344, ratio = Math.min(1, max / Math.max(1, b.width));
        canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
        canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
        gl!.viewport(0, 0, canvas.width, canvas.height);
    }
    function draw(now: number) {
        frame = 0;
        if (closed || document.hidden || motion.matches || !ready || !visible || gl!.isContextLost())
            return;
        if (!holder.closest('.hero')?.hasAttribute('data-atlas-covered')) {
            gl!.uniform2f(uniforms.box, canvas.width, canvas.height);
            gl!.uniform2f(uniforms.art, 16, 9);
            gl!.uniform1f(uniforms.look, (parseFloat(holder.style.getPropertyValue('--look-x')) || 45.5) / 100);
            gl!.uniform1f(uniforms.time, (now / 1000) % 600);
            gl!.uniform2f(uniforms.touch, px, py);
            gl!.uniform1f(uniforms.pulse, Math.min(12, (now - lastPulse) / 1000));
            gl!.drawArrays(gl!.TRIANGLES, 0, 3);
            canvas.dataset.water = 'webgl2';
            canvas.dataset.phase = String((++draws) % 240);
        }
        timer = window.setTimeout(queue, 42);
    }
    function stop() { cancelAnimationFrame(frame); clearTimeout(timer); frame = timer = 0; }
    function queue() { if (!frame && !closed && visible && ready && !document.hidden && !motion.matches)
        frame = requestAnimationFrame(draw); }
    function upload() { if (!photo.complete || !photo.naturalWidth)
        return; try {
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, photo);
        ready = true;
        resize();
        queue();
    }
    catch {
        ready = false;
    } }
    function pulse(e: PointerEvent) { const b = canvas.getBoundingClientRect(); const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height; if (x >= 0 && x <= 1 && y > .60 && y <= 1) {
        px = x;
        py = Math.max(.755, y);
        lastPulse = performance.now();
    } }
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible)
        queue();
    else
        stop(); });
    io.observe(canvas);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const onMotion = () => { stop(); canvas.hidden = motion.matches; queue(); };
    const visibility = () => { if (document.hidden)
        stop();
    else
        queue(); };
    photo.addEventListener('load', upload);
    holder.addEventListener('pointerdown', pulse);
    document.addEventListener('visibilitychange', visibility);
    motion.addEventListener('change', onMotion);
    upload();
    return () => { closed = true; stop(); io.disconnect(); ro.disconnect(); photo.removeEventListener('load', upload); holder.removeEventListener('pointerdown', pulse); motion.removeEventListener('change', onMotion); document.removeEventListener('visibilitychange', visibility); gl.deleteTexture(texture); gl.deleteBuffer(buffer); free(); };
}
