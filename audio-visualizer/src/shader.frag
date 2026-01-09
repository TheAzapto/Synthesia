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

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;

  uv += 0.01 * vec2(
    sin(u_time + uv.y * 6.0),
    cos(u_time + uv.x * 6.0)
  ) * u_mid;

  // Read previous frame
  vec3 prev = texture2D(u_prev, uv).rgb;

  // Audio-driven noise distortion
  float n = noise(uv * 3.0 + u_time * 0.2);
  vec2 flow = vec2(
    sin(n * 6.283 + u_time),
    cos(n * 6.283 + u_time)
  );

  flow *= 0.008;
  flow *= mix(u_low, u_high, uv.y);

  vec3 feedback = texture2D(u_prev, uv + flow).rgb;

  // Inject fresh color (audio-controlled)
  float ring = sin(length(uv - 0.5) * 20.0 - u_time * 4.0);
  ring = smoothstep(-0.2, 0.2, ring);

  vec3 inject = vec3(
    u_low * ring,
    u_mid * ring,
    u_high * ring
  );

  // Blend feedback + injection
  vec3 color = mix(feedback, inject, 0.015);

  // Decay (controls trail length)
  color *= 0.985;

  gl_FragColor = vec4(color, 1.0);
}
