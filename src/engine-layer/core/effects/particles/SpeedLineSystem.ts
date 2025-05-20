import * as THREE from 'three';

const MIN_LINE_LENGTH = 1.0;  // Minimum line length for visibility
const BASE_LINE_LENGTH = 2.0; // Base length before speed scaling

interface SpeedLine {
  position: THREE.Vector3;
  length: number;
  width: number;
  color: THREE.Color;
  life: number;
  maxLife: number;
  velocity: THREE.Vector3;
  phase: number;  // For animation
}

export class SpeedLineSystem {
  private scene: THREE.Scene;
  private lines: SpeedLine[] = [];
  private geometry: THREE.BufferGeometry;
  private material: THREE.LineBasicMaterial;
  private linesMesh: THREE.LineSegments;
  private maxLines: number;

  constructor(scene: THREE.Scene, maxLines: number = 100) {
    this.scene = scene;
    this.maxLines = maxLines;

    // Create geometry for all possible lines
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxLines * 6);  // 2 points per line * 3 coordinates
    const colors = new Float32Array(maxLines * 6);     // 2 points per line * 3 color components
    
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Material with per-vertex colors
    this.material = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      linewidth: 2
    });

    // Create mesh and add to scene
    this.linesMesh = new THREE.LineSegments(this.geometry, this.material);
    this.scene.add(this.linesMesh);
  }

  addLine(position: THREE.Vector3, velocity: THREE.Vector3, color: THREE.Color, length?: number): void {
    if (this.lines.length >= this.maxLines) return;

    const line: SpeedLine = {
      position: position.clone(),
      length: length || Math.max(MIN_LINE_LENGTH, velocity.length() * BASE_LINE_LENGTH),
      width: 1.0,
      color: color.clone(),
      life: 1.0,
      maxLife: 1.0,
      velocity: velocity.clone(),
      phase: Math.random() * Math.PI * 2  // Random start phase
    };

    this.lines.push(line);
    this.updateGeometry();
  }

  update(deltaTime: number): void {
    // Update existing lines
    this.lines = this.lines.filter(line => {
      line.life -= deltaTime;
      
      // Move line based on velocity
      line.position.add(line.velocity.clone().multiplyScalar(deltaTime));
      
      // Animate width using sine wave
      line.width = 0.5 + Math.sin(line.phase + performance.now() * 0.005) * 0.5;
      line.phase += deltaTime * 5;

      return line.life > 0;
    });

    this.updateGeometry();
  }

  addFormationLines(position: THREE.Vector3, velocity: THREE.Vector3, spread: number, color: THREE.Color): void {
    const speed = velocity.length();
    // Ensure minimum line length
    const lineLength = Math.max(MIN_LINE_LENGTH, BASE_LINE_LENGTH * speed);
    // Calculate view-space vectors for V formation
    const forward = velocity.clone().normalize();
    
    // Get right vector (cross product of world-up and forward)
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
    
    // Get view-space up (cross product of forward and right)
    const viewUp = new THREE.Vector3().crossVectors(forward, right).normalize();
    
    // Use viewUp for spread direction
    const spreadDir = viewUp.multiplyScalar(spread);
    
    // Center line - longer and brighter
    this.addLine(
      position,
      velocity.clone().multiplyScalar(1.2),  // Faster center line
      color.clone().multiplyScalar(1.5),     // Brighter center
      lineLength * 1.5                       // Even longer center line for better visibility
    );

    // Inner lines - angled outward
    const innerSpread = spreadDir.clone().multiplyScalar(0.7);
    const innerVelocity = velocity.clone().multiplyScalar(1.0);
    
    this.addLine(
      position.clone().add(innerSpread),
      innerVelocity.clone().add(innerSpread.clone().multiplyScalar(0.2)),
      color.clone().multiplyScalar(1.2),
      lineLength * 1.2
    );
    this.addLine(
      position.clone().sub(innerSpread),
      innerVelocity.clone().sub(innerSpread.clone().multiplyScalar(0.2)),
      color.clone().multiplyScalar(1.2),
      lineLength * 1.2
    );

    // Outer lines - more spread, shorter but still visible
    const outerSpread = spreadDir.clone().multiplyScalar(1.8);
    const outerVelocity = velocity.clone().multiplyScalar(0.9);
    
    this.addLine(
      position.clone().add(outerSpread),
      outerVelocity.clone().add(outerSpread.clone().multiplyScalar(0.3)),
      color.clone().multiplyScalar(0.8),  // Slightly brighter outer lines
      lineLength * 0.9                    // Not too short
    );
    this.addLine(
      position.clone().sub(outerSpread),
      outerVelocity.clone().sub(outerSpread.clone().multiplyScalar(0.3)),
      color.clone().multiplyScalar(0.8),
      lineLength * 0.9
    );
  }

  private updateGeometry(): void {
    const positions = this.geometry.attributes.position.array as Float32Array;
    const colors = this.geometry.attributes.color.array as Float32Array;
    let offset = 0;

    this.lines.forEach(line => {
      // Calculate end point based on velocity direction and length
      const direction = line.velocity.clone().normalize();
      // Calculate end point with slight curve
      const t = line.life / line.maxLife;
      const curve = Math.sin(t * Math.PI) * 0.2;  // Max curve at middle of life
      const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
      
      const endPoint = line.position.clone().add(
        direction.multiplyScalar(line.length * line.width)
          .add(perpendicular.multiplyScalar(curve * line.length))
      );

      // Start point
      positions[offset] = line.position.x;
      positions[offset + 1] = line.position.y;
      positions[offset + 2] = line.position.z;

      // End point
      positions[offset + 3] = endPoint.x;
      positions[offset + 4] = endPoint.y;
      positions[offset + 5] = endPoint.z;

      // Colors with fade based on life
      const alpha = line.life / line.maxLife;
      colors[offset] = line.color.r;
      colors[offset + 1] = line.color.g;
      colors[offset + 2] = line.color.b * alpha;
      colors[offset + 3] = line.color.r * 0.5;
      colors[offset + 4] = line.color.g * 0.5;
      colors[offset + 5] = line.color.b * 0.5 * alpha;

      offset += 6;
    });

    // Clear unused segments
    for (let i = offset; i < this.maxLines * 6; i++) {
      positions[i] = 0;
      colors[i] = 0;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.linesMesh);
  }
}
