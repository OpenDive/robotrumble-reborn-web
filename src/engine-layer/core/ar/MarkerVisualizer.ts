import * as THREE from 'three';
import { Marker } from './MarkerDetector';
import { IVideoSource } from '../video/types';

interface MarkerVisualizerConfig {
  videoScale?: number;     // Scale factor for video plane (default: 1.5)
  baseHeight?: number;     // Base height in world units (default: 2.0)
  zDistance?: number;      // Distance from camera (default: 0.1)
  boxSize?: number;        // Size of marker box relative to video scale (default: 0.2)
  axesSize?: number;       // Size of axes relative to video scale (default: 0.3)
  cornerSize?: number;     // Size of corner markers relative to video scale (default: 0.015)
}

export class MarkerVisualizer {
  private scene: THREE.Scene | null = null;
  private markerMeshes: Map<number, THREE.Group> = new Map();
  private videoSource: IVideoSource;
  private config: Required<MarkerVisualizerConfig>;

  constructor(videoSource: IVideoSource, config?: MarkerVisualizerConfig) {
    this.videoSource = videoSource;
    
    // Set default configuration
    this.config = {
      videoScale: config?.videoScale ?? 1.5,
      baseHeight: config?.baseHeight ?? 2.0,
      zDistance: config?.zDistance ?? 0.1,
      boxSize: config?.boxSize ?? 0.2,
      axesSize: config?.axesSize ?? 0.3,
      cornerSize: config?.cornerSize ?? 0.015
    };
  }

  attachToScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  detachFromScene(): void {
    if (this.scene) {
      // Remove all marker meshes from scene
      for (const [_, group] of this.markerMeshes) {
        this.scene.remove(group);
      }
      this.markerMeshes.clear();
      this.scene = null;
    }
  }

  updateVisuals(markers: Marker[]): void {
    if (!this.scene) {
      console.warn('MarkerVisualizer: No scene attached');
      return;
    }

    this.removeInactiveMarkers(markers);
    this.updateOrCreateMarkers(markers);
  }

  private removeInactiveMarkers(markers: Marker[]): void {
    // Remove old marker meshes that are no longer detected
    for (const [id, group] of this.markerMeshes) {
      if (!markers.find(m => m.id === id)) {
        this.scene?.remove(group);
        this.markerMeshes.delete(id);
      }
    }
  }

  private updateOrCreateMarkers(markers: Marker[]): void {
    if (!this.scene) return;

    const videoElement = this.videoSource.getVideoElement();
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;
    
    // Calculate video aspect ratio and scale factors
    const videoAspect = videoWidth / videoHeight;
    const scaleY = this.config.baseHeight / 2;
    const scaleX = scaleY * videoAspect;
    
    markers.forEach((marker) => {
      let markerGroup = this.markerMeshes.get(marker.id);
      
      if (!markerGroup) {
        // Create new marker visualization group
        markerGroup = new THREE.Group();
        
        // Create cube with colored faces
        const cubeSize = this.config.boxSize * this.config.videoScale;
        const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        
        // Create materials for each face
        const materials = [
          new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 }), // Right - Red
          new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.6 }), // Left - Blue
          new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.6 }), // Top - Green
          new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.6 }), // Bottom - Yellow
          new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.6 }), // Front - Magenta
          new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 })  // Back - Cyan
        ];
        
        // Create cube mesh with materials
        const cubeMesh = new THREE.Mesh(cubeGeometry, materials);
        
        // Add wireframe overlay
        const wireframeGeometry = new THREE.BoxGeometry(cubeSize * 1.001, cubeSize * 1.001, cubeSize * 1.001);
        const wireframeMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          wireframe: true,
          transparent: true,
          opacity: 0.2
        });
        const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        
        // Add cube and wireframe to group
        markerGroup.add(cubeMesh);
        markerGroup.add(wireframeMesh);
        
        // Create custom axes with labels and arrows
        const axesGroup = new THREE.Group();
        const axesSize = this.config.axesSize * this.config.videoScale;
        
        // X-axis (red)
        const xAxis = new THREE.ArrowHelper(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 0, 0),
          axesSize,
          0xff0000,
          axesSize * 0.2,  // Head length
          axesSize * 0.1   // Head width
        );
        const xLabel = this.createAxisLabel('X', 0xff0000);
        xLabel.position.set(axesSize + 0.05, 0, 0);
        axesGroup.add(xAxis);
        axesGroup.add(xLabel);
        
        // Y-axis (green)
        const yAxis = new THREE.ArrowHelper(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, 0),
          axesSize,
          0x00ff00,
          axesSize * 0.2,
          axesSize * 0.1
        );
        const yLabel = this.createAxisLabel('Y', 0x00ff00);
        yLabel.position.set(0, axesSize + 0.05, 0);
        axesGroup.add(yAxis);
        axesGroup.add(yLabel);
        
        // Z-axis (blue)
        const zAxis = new THREE.ArrowHelper(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, 0),
          axesSize,
          0x0000ff,
          axesSize * 0.2,
          axesSize * 0.1
        );
        const zLabel = this.createAxisLabel('Z', 0x0000ff);
        zLabel.position.set(0, 0, axesSize + 0.05);
        axesGroup.add(zAxis);
        axesGroup.add(zLabel);
        
        markerGroup.add(axesGroup);
        
        // Add corner visualization with improved materials
        const cornerGeometry = new THREE.SphereGeometry(this.config.cornerSize * this.config.videoScale);
        const cornerMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xffff00,
          transparent: true,
          opacity: 0.8
        });
        
        // Add numbered corners for better tracking
        for (let i = 0; i < 4; i++) {
          const cornerGroup = new THREE.Group();
          const corner = new THREE.Mesh(cornerGeometry, cornerMaterial);
          cornerGroup.add(corner);
          
          // Add corner number label
          const label = this.createAxisLabel(String(i), 0xffff00);
          label.scale.set(0.5, 0.5, 0.5);
          label.position.set(
            this.config.cornerSize * this.config.videoScale * 2,
            this.config.cornerSize * this.config.videoScale * 2,
            0
          );
          cornerGroup.add(label);
          
          cornerGroup.name = `corner${i}`;
          markerGroup.add(cornerGroup);
        }
        
        this.markerMeshes.set(marker.id, markerGroup);
        if (this.scene) {
          this.scene.add(markerGroup);
        }
      }
      
      // Transform marker corners to scene space
      const transformedCorners = marker.corners.map(corner => {
        const x = ((corner.x / videoWidth) - 0.5) * 2 * scaleX * this.config.videoScale;
        const y = (0.5 - (corner.y / videoHeight)) * 2 * scaleY * this.config.videoScale;
        return new THREE.Vector3(x, y, -this.config.zDistance);
      });
      
      // Calculate marker center in scene space
      const centerX = ((marker.center.x / videoWidth) - 0.5) * 2 * scaleX * this.config.videoScale;
      const centerY = (0.5 - (marker.center.y / videoHeight)) * 2 * scaleY * this.config.videoScale;
      const centerPos = new THREE.Vector3(centerX, centerY, -this.config.zDistance);

      // Update marker position and orientation
      const currentMarkerGroup = this.markerMeshes.get(marker.id);
      if (currentMarkerGroup) {
        // Set base position using video coordinates
        currentMarkerGroup.position.copy(centerPos);

        // If we have pose information, use it for rotation and Z-depth
        if (marker.pose) {
          // Add Z-translation for depth perception
          const zScale = 0.0001; // Small scale factor for millimeter to scene units
          const zDistance = Math.abs(marker.pose.bestTranslation[2] * zScale);
          currentMarkerGroup.position.z = -zDistance;

          // Calculate scale compensation based on Z-distance
          const baseDistance = this.config.zDistance;
          const compensationScale = zDistance / baseDistance;
          currentMarkerGroup.scale.setScalar(1 / compensationScale);

          // Convert pose rotation matrix to THREE.js matrix with coordinate system correction
          const rotationMatrix = new THREE.Matrix4();
          const r = marker.pose.bestRotation;
          rotationMatrix.set(
            r[0][0],   r[0][1],  -r[0][2],  0,
            r[1][0],   r[1][1],  -r[1][2],  0,
            -r[2][0], -r[2][1],   r[2][2],  0,
            0,        0,          0,         1
          );

          // Apply rotation to group
          currentMarkerGroup.setRotationFromMatrix(rotationMatrix);

          // Update corner positions in local space
          transformedCorners.forEach((worldCorner, i) => {
            const cornerGroup = currentMarkerGroup.getObjectByName(`corner${i}`) as THREE.Group | undefined;
            if (cornerGroup) {
              // Convert world corner to local space relative to marker center
              const localCorner = worldCorner.clone()
                .sub(centerPos)
                .applyMatrix4(new THREE.Matrix4().copy(rotationMatrix).invert());
              
              cornerGroup.position.copy(localCorner);
            }
          });
        }
      }
    });
  }

  private createAxisLabel(text: string, color: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      context.font = 'bold 48px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, 32, 32);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(0.1, 0.1, 1);
    
    return sprite;
  }

  dispose(): void {
    this.detachFromScene();
    // Cleanup all THREE.js resources
    for (const [_, group] of this.markerMeshes) {
      this.disposeGroup(group);
    }
    this.markerMeshes.clear();
  }

  private disposeGroup(group: THREE.Group): void {
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    });
  }
} 