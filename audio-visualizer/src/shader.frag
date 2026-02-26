precision highp float;

uniform float u_time;
uniform float u_low;
uniform float u_mid;
uniform float u_high;
uniform vec2 u_resolution;
uniform sampler2D u_prev;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1, 0));
  float c = hash(i + vec2(0, 1));
  float d = hash(i + vec2(1, 1));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

/* HSV → RGB for smooth rainbow palettes */
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

/* ══════════ Signed Distance Functions ══════════ */

/* Circle */
float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

/* Ring (hollow circle) */
float sdRing(vec2 p, float r, float thickness) {
  return abs(length(p) - r) - thickness;
}

/* Rounded box */
float sdBox(vec2 p, vec2 size, float r) {
  vec2 d = abs(p) - size + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

/* Equilateral triangle */
float sdTriangle(vec2 p, float r) {
  const float k = 1.732050808; // sqrt(3)
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

/* 2D rotation helper */
vec2 rotate2d(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 centered = uv - 0.5;
  /* Correct aspect ratio so shapes aren't stretched */
  float aspect = u_resolution.x / u_resolution.y;
  vec2 st = vec2(centered.x * aspect, centered.y);

  float dist = length(centered);
  float angle = atan(centered.y, centered.x);

  /* ---------- Flow distortion (audio-reactive) ---------- */
  float energy = u_low * 0.5 + u_mid * 0.3 + u_high * 0.2;

  uv += 0.015 * vec2(
    sin(u_time * 0.8 + uv.y * 8.0),
    cos(u_time * 0.8 + uv.x * 8.0)
  ) * (0.3 + u_mid * 2.0);

  vec3 prev = texture2D(u_prev, uv).rgb;

  /* ---------- Noise-based flow field ---------- */
  float n  = noise(uv * 4.0 + u_time * 0.3);
  float n2 = noise(uv * 7.0 - u_time * 0.2);
  vec2 flow = vec2(
    sin(n * 6.283 + u_time * 1.2),
    cos(n * 6.283 + u_time * 1.2)
  );

  flow *= 0.012 * (0.4 + energy * 2.5);

  vec3 feedback = texture2D(u_prev, uv + flow).rgb;

  /* ---------- Color injection — vibrant rainbow palette ---------- */

  // Expanding ring pattern
  float ring = sin(dist * 25.0 - u_time * 5.0);
  ring = smoothstep(-0.15, 0.15, ring);

  // Spiral arms
  float spiral = sin(angle * 3.0 + dist * 12.0 - u_time * 3.0);
  spiral = smoothstep(-0.3, 0.3, spiral);

  // Hue rotates with time, angle, and audio
  float hue1 = fract(u_time * 0.05 + dist * 0.8 + u_low * 0.3);
  float hue2 = fract(u_time * 0.07 + angle / 6.283 + u_high * 0.4);
  float hue3 = fract(u_time * 0.03 + n * 0.5 + u_mid * 0.5);

  vec3 col1 = hsv2rgb(vec3(hue1, 0.9, 1.0));  // Ring color
  vec3 col2 = hsv2rgb(vec3(hue2, 0.85, 0.95)); // Spiral color
  vec3 col3 = hsv2rgb(vec3(hue3, 0.8, 0.9));   // Ambient noise color

  // Combine patterns
  vec3 inject = col1 * ring * u_low * 1.5
              + col2 * spiral * u_high * 1.2
              + col3 * n2 * u_mid * 0.8;

  /* ---------- Geometric shapes (SDF, audio-reactive) ---------- */

  // ── 1. Bass-pulsing glowing ring ──
  float ringRadius = 0.18 + u_low * 0.08;
  float ringDist = sdRing(st, ringRadius, 0.008);
  float ringGlow = exp(-abs(ringDist) * 35.0);            // soft glow falloff
  float ringEdge = 1.0 - smoothstep(-0.003, 0.003, ringDist); // hard edge
  float ringShape = ringEdge + ringGlow * 0.6;

  vec3 ringCol = hsv2rgb(vec3(fract(u_time * 0.08), 0.95, 1.0));
  inject += ringCol * ringShape * (0.8 + u_low * 1.5);

  // ── 2. Rotating triangle (reacts to mids) ──
  vec2 triP = rotate2d(st, u_time * 0.7 + u_mid * 2.0);
  float triSize = 0.09 + u_mid * 0.05;
  float triDist = sdTriangle(triP, triSize);
  float triGlow = exp(-abs(triDist) * 40.0);
  float triEdge = 1.0 - smoothstep(-0.003, 0.003, triDist);
  float triShape = triEdge + triGlow * 0.5;

  vec3 triCol = hsv2rgb(vec3(fract(u_time * 0.08 + 0.33), 0.9, 0.95));
  inject += triCol * triShape * (0.6 + u_mid * 1.2);

  // ── 3. Tiled dots grid (reacts to highs) ──
  float tileScale = 5.0;
  vec2 tileUV = fract(st * tileScale + u_time * 0.15) - 0.5;
  float dotRadius = 0.04 + u_high * 0.04;
  float dotDist = sdCircle(tileUV, dotRadius);
  float dotGlow = exp(-max(dotDist, 0.0) * 25.0);
  float dotMask = 1.0 - smoothstep(-0.002, 0.005, dotDist);
  float dotShape = dotMask + dotGlow * 0.4;

  vec3 dotCol = hsv2rgb(vec3(fract(u_time * 0.12 + 0.66), 0.85, 0.9));
  inject += dotCol * dotShape * u_high * 1.0;

  // ── 4. Spinning rounded box (reacts to energy) ──
  vec2 boxP = rotate2d(st, -u_time * 0.5);
  float boxSize = 0.10 + energy * 0.06;
  float boxDist = sdBox(boxP, vec2(boxSize, boxSize * 0.6), 0.02);
  float boxGlow = exp(-abs(boxDist) * 30.0);

  vec3 boxCol = hsv2rgb(vec3(fract(u_time * 0.06 + 0.5), 0.9, 1.0));
  inject += boxCol * boxGlow * (0.4 + energy * 0.8);

  /* ---------- Mix with feedback ---------- */
  // Boost injection intensity based on audio energy
  float injectStrength = 0.04 + energy * 0.12;
  vec3 color = mix(feedback, inject, injectStrength);

  /* ---------- Bloom glow for bright spots ---------- */
  float brightness = dot(color, vec3(0.299, 0.587, 0.114));
  color += color * smoothstep(0.4, 0.9, brightness) * 0.3;

  /* ---------- Vignette — subtle darkening at edges ---------- */
  float vignette = 1.0 - smoothstep(0.3, 0.85, dist * 1.1);
  color *= mix(0.6, 1.0, vignette);

  /* ---------- Decay (longer trails = more vibrant feel) ---------- */
  color *= 0.992;

  /* ---------- Minimum ambient glow so it never goes fully black ---------- */
  float ambientHue = fract(u_time * 0.02 + uv.x * 0.3);
  vec3 ambient = hsv2rgb(vec3(ambientHue, 0.6, 0.04));
  color = max(color, ambient);

  gl_FragColor = vec4(color, 1.0);
}
