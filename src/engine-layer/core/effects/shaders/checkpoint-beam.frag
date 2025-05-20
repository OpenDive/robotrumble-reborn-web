uniform float time;
uniform vec3 baseColor;
uniform float opacity;
varying vec2 vUv;

void main() {
  float wave = sin(vUv.y * 20.0 + time * 2.0) * 0.5 + 0.5;
  float scan = mod(vUv.y - time * 0.5, 1.0);
  scan = smoothstep(0.0, 0.1, scan) * smoothstep(1.0, 0.9, scan);
  
  vec3 color = baseColor * (wave * 0.3 + 0.7);
  color += baseColor * scan * 0.5;
  
  gl_FragColor = vec4(color, opacity * (wave * 0.5 + 0.5));
}
