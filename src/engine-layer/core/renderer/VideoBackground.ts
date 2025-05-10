import * as THREE from 'three';
import { VideoSource } from '../video/VideoSource';

/**
 * Handles rendering video as a background in ThreeJS scene
 */
export class VideoBackground {
  private mesh: THREE.Mesh;
  private texture: THREE.VideoTexture;
  private material: THREE.MeshBasicMaterial;

  constructor(videoSource: VideoSource) {
    // Create video texture
    this.texture = new THREE.VideoTexture(videoSource.getVideoElement());
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    // Create material
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      side: THREE.DoubleSide
    });

    // Create plane geometry that fills the view
    const geometry = new THREE.PlaneGeometry(2, 2);
    
    // Create mesh
    this.mesh = new THREE.Mesh(geometry, this.material);
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
