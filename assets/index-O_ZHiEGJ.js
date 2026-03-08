(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))r(i);new MutationObserver(i=>{for(const a of i)if(a.type==="childList")for(const u of a.addedNodes)u.tagName==="LINK"&&u.rel==="modulepreload"&&r(u)}).observe(document,{childList:!0,subtree:!0});function s(i){const a={};return i.integrity&&(a.integrity=i.integrity),i.referrerPolicy&&(a.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?a.credentials="include":i.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function r(i){if(i.ep)return;i.ep=!0;const a=s(i);fetch(i.href,a)}})();const U=`attribute vec2 position;\r
void main() {\r
  gl_Position = vec4(position, 0.0, 1.0);\r
}`,I=`precision highp float;\r
\r
uniform float u_time;\r
uniform float u_low;\r
uniform float u_mid;\r
uniform float u_high;\r
uniform vec2 u_resolution;\r
uniform sampler2D u_prev;\r
\r
float hash(vec2 p) {\r
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);\r
}\r
\r
float noise(vec2 p) {\r
  vec2 i = floor(p);\r
  vec2 f = fract(p);\r
  f = f * f * (3.0 - 2.0 * f);\r
\r
  float a = hash(i);\r
  float b = hash(i + vec2(1, 0));\r
  float c = hash(i + vec2(0, 1));\r
  float d = hash(i + vec2(1, 1));\r
\r
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);\r
}\r
\r
/* HSV → RGB for smooth rainbow palettes */\r
vec3 hsv2rgb(vec3 c) {\r
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);\r
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);\r
}\r
\r
/* ══════════ Signed Distance Functions ══════════ */\r
\r
/* Circle */\r
float sdCircle(vec2 p, float r) {\r
  return length(p) - r;\r
}\r
\r
/* Ring (hollow circle) */\r
float sdRing(vec2 p, float r, float thickness) {\r
  return abs(length(p) - r) - thickness;\r
}\r
\r
/* Rounded box */\r
float sdBox(vec2 p, vec2 size, float r) {\r
  vec2 d = abs(p) - size + r;\r
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;\r
}\r
\r
/* Equilateral triangle */\r
float sdTriangle(vec2 p, float r) {\r
  const float k = 1.732050808; // sqrt(3)\r
  p.x = abs(p.x) - r;\r
  p.y = p.y + r / k;\r
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;\r
  p.x -= clamp(p.x, -2.0 * r, 0.0);\r
  return -length(p) * sign(p.y);\r
}\r
\r
/* 2D rotation helper */\r
vec2 rotate2d(vec2 p, float a) {\r
  float c = cos(a);\r
  float s = sin(a);\r
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);\r
}\r
\r
void main() {\r
  vec2 uv = gl_FragCoord.xy / u_resolution;\r
  vec2 centered = uv - 0.5;\r
  /* Correct aspect ratio so shapes aren't stretched */\r
  float aspect = u_resolution.x / u_resolution.y;\r
  vec2 st = vec2(centered.x * aspect, centered.y);\r
\r
  float dist = length(centered);\r
  float angle = atan(centered.y, centered.x);\r
\r
  /* ---------- Flow distortion (audio-reactive) ---------- */\r
  float energy = u_low * 0.5 + u_mid * 0.3 + u_high * 0.2;\r
\r
  uv += 0.015 * vec2(\r
    sin(u_time * 0.8 + uv.y * 8.0),\r
    cos(u_time * 0.8 + uv.x * 8.0)\r
  ) * (0.3 + u_mid * 2.0);\r
\r
  vec3 prev = texture2D(u_prev, uv).rgb;\r
\r
  /* ---------- Noise-based flow field ---------- */\r
  float n  = noise(uv * 4.0 + u_time * 0.3);\r
  float n2 = noise(uv * 7.0 - u_time * 0.2);\r
  vec2 flow = vec2(\r
    sin(n * 6.283 + u_time * 1.2),\r
    cos(n * 6.283 + u_time * 1.2)\r
  );\r
\r
  flow *= 0.012 * (0.4 + energy * 2.5);\r
\r
  vec3 feedback = texture2D(u_prev, uv + flow).rgb;\r
\r
  /* ---------- Color injection — vibrant rainbow palette ---------- */\r
\r
  // Expanding ring pattern\r
  float ring = sin(dist * 25.0 - u_time * 5.0);\r
  ring = smoothstep(-0.15, 0.15, ring);\r
\r
  // Spiral arms\r
  float spiral = sin(angle * 3.0 + dist * 12.0 - u_time * 3.0);\r
  spiral = smoothstep(-0.3, 0.3, spiral);\r
\r
  // Hue rotates with time, angle, and audio\r
  float hue1 = fract(u_time * 0.05 + dist * 0.8 + u_low * 0.3);\r
  float hue2 = fract(u_time * 0.07 + angle / 6.283 + u_high * 0.4);\r
  float hue3 = fract(u_time * 0.03 + n * 0.5 + u_mid * 0.5);\r
\r
  vec3 col1 = hsv2rgb(vec3(hue1, 0.9, 1.0));  // Ring color\r
  vec3 col2 = hsv2rgb(vec3(hue2, 0.85, 0.95)); // Spiral color\r
  vec3 col3 = hsv2rgb(vec3(hue3, 0.8, 0.9));   // Ambient noise color\r
\r
  // Combine patterns\r
  vec3 inject = col1 * ring * u_low * 1.5\r
              + col2 * spiral * u_high * 1.2\r
              + col3 * n2 * u_mid * 0.8;\r
\r
  /* ---------- Geometric shapes (SDF, audio-reactive) ---------- */\r
\r
  // ── 1. Bass-pulsing glowing ring ──\r
  float ringRadius = 0.18 + u_low * 0.08;\r
  float ringDist = sdRing(st, ringRadius, 0.008);\r
  float ringGlow = exp(-abs(ringDist) * 35.0);            // soft glow falloff\r
  float ringEdge = 1.0 - smoothstep(-0.003, 0.003, ringDist); // hard edge\r
  float ringShape = ringEdge + ringGlow * 0.6;\r
\r
  vec3 ringCol = hsv2rgb(vec3(fract(u_time * 0.08), 0.95, 1.0));\r
  inject += ringCol * ringShape * (0.8 + u_low * 1.5);\r
\r
  // ── 2. Rotating triangle (reacts to mids) ──\r
  vec2 triP = rotate2d(st, u_time * 0.7 + u_mid * 2.0);\r
  float triSize = 0.09 + u_mid * 0.05;\r
  float triDist = sdTriangle(triP, triSize);\r
  float triGlow = exp(-abs(triDist) * 40.0);\r
  float triEdge = 1.0 - smoothstep(-0.003, 0.003, triDist);\r
  float triShape = triEdge + triGlow * 0.5;\r
\r
  vec3 triCol = hsv2rgb(vec3(fract(u_time * 0.08 + 0.33), 0.9, 0.95));\r
  inject += triCol * triShape * (0.6 + u_mid * 1.2);\r
\r
  // ── 3. Tiled dots grid (reacts to highs) ──\r
  float tileScale = 5.0;\r
  vec2 tileUV = fract(st * tileScale + u_time * 0.15) - 0.5;\r
  float dotRadius = 0.04 + u_high * 0.04;\r
  float dotDist = sdCircle(tileUV, dotRadius);\r
  float dotGlow = exp(-max(dotDist, 0.0) * 25.0);\r
  float dotMask = 1.0 - smoothstep(-0.002, 0.005, dotDist);\r
  float dotShape = dotMask + dotGlow * 0.4;\r
\r
  vec3 dotCol = hsv2rgb(vec3(fract(u_time * 0.12 + 0.66), 0.85, 0.9));\r
  inject += dotCol * dotShape * u_high * 1.0;\r
\r
  // ── 4. Spinning rounded box (reacts to energy) ──\r
  vec2 boxP = rotate2d(st, -u_time * 0.5);\r
  float boxSize = 0.10 + energy * 0.06;\r
  float boxDist = sdBox(boxP, vec2(boxSize, boxSize * 0.6), 0.02);\r
  float boxGlow = exp(-abs(boxDist) * 30.0);\r
\r
  vec3 boxCol = hsv2rgb(vec3(fract(u_time * 0.06 + 0.5), 0.9, 1.0));\r
  inject += boxCol * boxGlow * (0.4 + energy * 0.8);\r
\r
  /* ---------- Mix with feedback ---------- */\r
  // Boost injection intensity based on audio energy\r
  float injectStrength = 0.04 + energy * 0.12;\r
  vec3 color = mix(feedback, inject, injectStrength);\r
\r
  /* ---------- Bloom glow for bright spots ---------- */\r
  float brightness = dot(color, vec3(0.299, 0.587, 0.114));\r
  color += color * smoothstep(0.4, 0.9, brightness) * 0.3;\r
\r
  /* ---------- Vignette — subtle darkening at edges ---------- */\r
  float vignette = 1.0 - smoothstep(0.3, 0.85, dist * 1.1);\r
  color *= mix(0.6, 1.0, vignette);\r
\r
  /* ---------- Decay (longer trails = more vibrant feel) ---------- */\r
  color *= 0.992;\r
\r
  /* ---------- Minimum ambient glow so it never goes fully black ---------- */\r
  float ambientHue = fract(u_time * 0.02 + uv.x * 0.3);\r
  vec3 ambient = hsv2rgb(vec3(ambientHue, 0.6, 0.04));\r
  color = max(color, ambient);\r
\r
  gl_FragColor = vec4(color, 1.0);\r
}\r
`;function k(t,n,s){const r=t.getContext("webgl");i();function i(){t.width=window.innerWidth,t.height=window.innerHeight,r.viewport(0,0,t.width,t.height)}window.addEventListener("resize",i);function a(L,C){const m=r.createShader(L);return r.shaderSource(m,C),r.compileShader(m),r.getShaderParameter(m,r.COMPILE_STATUS)||console.error(r.getShaderInfoLog(m)),m}const u=a(r.VERTEX_SHADER,n),f=a(r.FRAGMENT_SHADER,s),h=r.createProgram();return r.attachShader(h,u),r.attachShader(h,f),r.linkProgram(h),r.useProgram(h),{gl:r,program:h}}function R(t,n,s){const r=t.createTexture();t.bindTexture(t.TEXTURE_2D,r),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,n,s,0,t.RGBA,t.UNSIGNED_BYTE,null),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);const i=t.createFramebuffer();return t.bindFramebuffer(t.FRAMEBUFFER,i),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,r,0),t.bindFramebuffer(t.FRAMEBUFFER,null),{fbo:i,tex:r}}class M{constructor(){this.ctx=null,this.analyser=null,this.gainNode=null,this.source=null,this.audioBuffer=null,this.data=null,this.low=0,this.mid=0,this.high=0,this.rms=0,this.beat=0,this.isPlaying=!1,this.isPaused=!1,this.songName="",this.duration=0,this._startedAt=0,this._offset=0}async initFromFile(n){if(this.source)try{this.source.stop()}catch{}this.ctx||(this.ctx=new AudioContext),this.ctx.state==="suspended"&&await this.ctx.resume();const s=await n.arrayBuffer();this.audioBuffer=await this.ctx.decodeAudioData(s),this.duration=this.audioBuffer.duration,this.songName=n.name.replace(/\.[^/.]+$/,""),this.gainNode||(this.gainNode=this.ctx.createGain()),this.analyser||(this.analyser=this.ctx.createAnalyser(),this.analyser.fftSize=1024,this.data=new Uint8Array(this.analyser.frequencyBinCount)),this._offset=0,this._startSource(0)}_startSource(n){this.source=this.ctx.createBufferSource(),this.source.buffer=this.audioBuffer,this.source.loop=!0,this.source.connect(this.gainNode),this.gainNode.connect(this.analyser),this.analyser.connect(this.ctx.destination),this.source.start(0,n),this._startedAt=this.ctx.currentTime,this._offset=n,this.isPlaying=!0,this.isPaused=!1}togglePlay(){this.audioBuffer&&(this.isPlaying&&!this.isPaused?this.pause():this.resume())}pause(){!this.ctx||!this.isPlaying||this.isPaused||(this._offset=this.getCurrentTime(),this.ctx.suspend(),this.isPaused=!0)}resume(){this.ctx&&(this.isPaused?(this.ctx.resume(),this.isPaused=!1):!this.isPlaying&&this.audioBuffer&&this._startSource(0))}stop(){if(this.source){try{this.source.stop()}catch{}this.source=null,this.isPlaying=!1,this.isPaused=!1,this._offset=0,this.ctx&&this.ctx.state==="suspended"&&this.ctx.resume()}}seek(n){if(!this.audioBuffer)return;const s=this.isPlaying&&!this.isPaused;if(this.source)try{this.source.stop()}catch{}this.ctx.state==="suspended"&&this.ctx.resume(),this._startSource(n%this.duration),s||this.pause()}setVolume(n){this.gainNode&&(this.gainNode.gain.value=Math.max(0,Math.min(1,n)))}getCurrentTime(){return this.isPlaying?this.isPaused?this._offset:(this.ctx.currentTime-this._startedAt+this._offset)%this.duration:this._offset}getDuration(){return this.duration}update(){if(!this.analyser)return;this.analyser.getByteFrequencyData(this.data);let n=0,s=0,r=0;const i=this.data.length;for(let u=0;u<i;u++){const f=this.data[u]/255;u<i*.2?n+=f:u<i*.6?s+=f:r+=f}n/=i*.2,s/=i*.4,r/=i*.4,this.low=this.smooth(this.low,n,.1),this.mid=this.smooth(this.mid,s,.08),this.high=this.smooth(this.high,r,.06),this.rms=(this.low+this.mid+this.high)/3;const a=this.rms;a>this.beat?this.beat=a:this.beat*=.92}smooth(n,s,r){return n+(s-n)*r}}const N=document.getElementById("app"),F=document.getElementById("landing"),P=document.getElementById("file"),S=document.getElementById("player"),G=document.getElementById("song-name"),O=document.getElementById("btn-play"),X=document.getElementById("btn-stop"),z=document.getElementById("btn-file"),j=document.getElementById("icon-play"),H=document.getElementById("icon-pause"),c=document.getElementById("progress"),g=document.getElementById("volume"),T=document.getElementById("time-current"),V=document.getElementById("time-total"),o=new M;async function q(t){await o.initFromFile(t),G.textContent=o.songName,V.textContent=w(o.getDuration()),c.value=0,F.classList.add("fade-out"),S.classList.remove("hidden"),_()}O.addEventListener("click",()=>{o.togglePlay(),_()});X.addEventListener("click",()=>{o.stop(),_(),c.value=0,T.textContent="0:00",E(c,0,1e3),x=0,p=-1,S.classList.add("hidden"),F.classList.remove("fade-out")});z.addEventListener("click",()=>{P.click()});P.addEventListener("change",t=>{t.target.files[0]&&q(t.target.files[0])});let v=!1;c.addEventListener("mousedown",()=>v=!0);c.addEventListener("touchstart",()=>v=!0,{passive:!0});c.addEventListener("input",()=>{if(!o.getDuration())return;const t=c.value/1e3*o.getDuration();T.textContent=w(t)});function A(){if(!v||(v=!1,!o.getDuration()))return;const t=c.value/1e3*o.getDuration();o.seek(t),_()}c.addEventListener("mouseup",A);c.addEventListener("touchend",A);g.addEventListener("input",()=>{const t=g.value/100;o.setVolume(t),E(g,g.value,100)});o.setVolume&&E(g,80,100);function _(){const t=o.isPlaying&&!o.isPaused;j.style.display=t?"none":"block",H.style.display=t?"block":"none"}function w(t){if(!t||!isFinite(t))return"0:00";const n=Math.floor(t/60),s=Math.floor(t%60);return`${n}:${s.toString().padStart(2,"0")}`}function E(t,n,s){const r=n/s*100;t.style.background=`linear-gradient(to right, rgba(0,240,255,0.7) ${r}%, rgba(255,255,255,0.1) ${r}%)`}const l=document.createElement("canvas");l.id="gl-canvas";N.appendChild(l);const{gl:e,program:d}=k(l,U,I),$=new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),W=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,W);e.bufferData(e.ARRAY_BUFFER,$,e.STATIC_DRAW);const B=e.getAttribLocation(d,"position");e.enableVertexAttribArray(B);e.vertexAttribPointer(B,2,e.FLOAT,!1,0,0);const Y=e.getUniformLocation(d,"u_time"),K=e.getUniformLocation(d,"u_low"),J=e.getUniformLocation(d,"u_mid"),Q=e.getUniformLocation(d,"u_high"),Z=e.getUniformLocation(d,"u_resolution"),tt=e.getUniformLocation(d,"u_prev");let et=R(e,l.width,l.height),rt=R(e,l.width,l.height),y=et,b=rt;e.bindFramebuffer(e.FRAMEBUFFER,y.fbo);e.clearColor(0,0,0,1);e.clear(e.COLOR_BUFFER_BIT);e.bindFramebuffer(e.FRAMEBUFFER,null);let x=0,p=-1;function D(t){if(o.isPlaying&&!o.isPaused&&p>=0&&(x+=(t-p)*.001),p=t,o.update(),o.isPlaying&&!v){const s=o.getCurrentTime(),r=o.getDuration();if(r>0){const i=s/r*1e3;c.value=i,T.textContent=w(s),E(c,i,1e3)}}e.useProgram(d),e.viewport(0,0,l.width,l.height),e.uniform1f(Y,x),e.uniform1f(K,o.low),e.uniform1f(J,o.mid),e.uniform1f(Q,o.high),e.uniform2f(Z,l.width,l.height),e.bindFramebuffer(e.FRAMEBUFFER,b.fbo),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,y.tex),e.uniform1i(tt,0),e.drawArrays(e.TRIANGLES,0,6),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindTexture(e.TEXTURE_2D,b.tex),e.drawArrays(e.TRIANGLES,0,6),[y,b]=[b,y],requestAnimationFrame(D)}D();
