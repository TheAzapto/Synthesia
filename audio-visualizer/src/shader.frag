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

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 centered = uv - 0.5;
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

  // Expanding ring
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
