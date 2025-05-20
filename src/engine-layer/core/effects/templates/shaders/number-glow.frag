uniform vec3 baseColor;
uniform vec3 glowColor;
uniform float opacity;
uniform float time;
uniform float glowStrength;
uniform float solidOpacity;

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
    
    // Combine effects for glow
    float glowIntensity = fresnel * pulse * glowStrength;
    
    // Mix solid color with glow
    vec3 finalColor = mix(baseColor, glowColor, glowIntensity);
    
    // Final color with opacity
    float finalOpacity = mix(solidOpacity, opacity * glowIntensity, glowIntensity);
    
    gl_FragColor = vec4(finalColor, finalOpacity);
}
