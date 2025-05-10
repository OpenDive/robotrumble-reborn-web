import * as THREE from 'three';

/**
 * Handles rendering video as a background in ThreeJS scene
 */
export class VideoBackground {
  private mesh: THREE.Mesh;
  private texture!: THREE.VideoTexture;
  private material: THREE.MeshBasicMaterial;
  private videoElement!: HTMLVideoElement;

  constructor() {
    // Create plane geometry that fills the view
    const geometry = new THREE.PlaneGeometry(2, 2);
    
    // Create empty material (will be updated in initialize)
    this.material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide
    });
    
    // Create mesh
    this.mesh = new THREE.Mesh(geometry, this.material);
  }

  initialize(videoElement: HTMLVideoElement): void {
    this.videoElement = videoElement;
    
    // Create video texture
    this.texture = new THREE.VideoTexture(this.videoElement);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    
    // Update material with texture
    this.material.map = this.texture;
    this.material.needsUpdate = true;
  }

  /**
   * Get the background mesh that can be added to a scene
   */
  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  /**
   * Update the background to match current video frame
   */
  update(): void {
    this.texture.needsUpdate = true;
  }

  /**
   * Clean up ThreeJS resources
   */
  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
