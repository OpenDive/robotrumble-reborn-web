uniform vec3 glowColor;
uniform float opacity;
uniform float time;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
    // Fresnel effect for edge glow
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.0);
    
    // Pulsing effect
    float pulse = (sin(time * 3.0) * 0.5 + 0.5) * 0.3 + 0.7;
    
    // Combine effects
    float glowIntensity = fresnel * pulse;
    vec3 finalColor = glowColor * (glowIntensity + 0.5);
    
    gl_FragColor = vec4(finalColor, opacity * glowIntensity);
}
