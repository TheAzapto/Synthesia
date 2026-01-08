precision highp float;

uniform float u_time;
uniform float u_low;
uniform float u_mid;
uniform float u_high;

void main() {
  vec2 uv = gl_FragCoord.xy / vec2(800.0, 600.0);

  vec3 color = vec3(
    u_low,
    u_mid * uv.x,
    u_high * uv.y
  );

  gl_FragColor = vec4(color, 1.0);
}
