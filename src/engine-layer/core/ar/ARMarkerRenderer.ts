import * as THREE from 'three';
import { DetectedMarker } from './SimpleARDetector';

interface ARMarkerConfig {
  baseHeight: number;     // Base height in world units for scaling
  cubeSize: number;       // Size of marker cubes
  axesSize: number;       // Size of coordinate axes
  videoScale: number;     // Scale factor for video plane
  zDistance: number;      // Base distance from camera
}

export class ARMarkerRenderer {
  private scene: THREE.Scene | null = null;
  private markerGroups: Map<number, THREE.Group> = new Map();
  private config: ARMarkerConfig;
  private videoElement: HTMLVideoElement | null = null;

  constructor(config?: Partial<ARMarkerConfig>) {
    this.config = {
      baseHeight: 2.0,
      cubeSize: 0.5,        // Much larger for debugging
      axesSize: 0.8,        // Much larger axes
      videoScale: 1.5,      // Match MarkerVisualizer
      zDistance: 2.0,       // Much farther from camera for debugging
      ...config
    };
  }

  initialize(scene: THREE.Scene): void {
    this.scene = scene;
  }

  setVideoElement(videoElement: HTMLVideoElement | null): void {
    this.videoElement = videoElement;
  }

  updateMarkers(markers: DetectedMarker[]): void {
    if (!this.scene || !this.videoElement) {
      return;
    }

    // Remove markers that are no longer detected
    this.removeInactiveMarkers(markers);
    
    // Update or create markers
    this.updateOrCreateMarkers(markers);
  }

  private removeInactiveMarkers(activeMarkers: DetectedMarker[]): void {
    const activeIds = new Set(activeMarkers.map(m => m.id));
    
    for (const [id, group] of this.markerGroups) {
      if (!activeIds.has(id)) {
        this.scene?.remove(group);
        this.disposeGroup(group);
        this.markerGroups.delete(id);
      }
    }
  }

  private updateOrCreateMarkers(markers: DetectedMarker[]): void {
    if (!this.scene || !this.videoElement) return;

    const videoWidth = this.videoElement.videoWidth;
    const videoHeight = this.videoElement.videoHeight;

    if (videoWidth === 0 || videoHeight === 0) {
      return;
    }

    // Calculate scaling factors for coordinate transformation (following MarkerVisualizer approach)
    const videoAspect = videoWidth / videoHeight;
    const scaleY = this.config.baseHeight / 2;
    const scaleX = scaleY * videoAspect;

    markers.forEach(marker => {
      let markerGroup = this.markerGroups.get(marker.id);

      if (!markerGroup) {
        console.log('Creating AR marker visualization for ID:', marker.id);
        // Create new marker visualization
        markerGroup = this.createMarkerGroup(marker.id);
        this.markerGroups.set(marker.id, markerGroup);
        this.scene!.add(markerGroup);
      }

      // Update marker position and orientation
      this.updateMarkerTransform(markerGroup, marker, scaleX, scaleY, videoWidth, videoHeight);
    });
  }

  private createMarkerGroup(markerId: number): THREE.Group {
    const group = new THREE.Group();
    group.name = `marker_${markerId}`;

    // Create colorful cube with different colored faces
    const cubeGeometry = new THREE.BoxGeometry(this.config.cubeSize, this.config.cubeSize, this.config.cubeSize);
    
    const materials = [
      new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 }), // Right - Red
      new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.8 }), // Left - Blue  
      new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 }), // Top - Green
      new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8 }), // Bottom - Yellow
      new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.8 }), // Front - Magenta
      new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 })  // Back - Cyan
    ];

    const cube = new THREE.Mesh(cubeGeometry, materials);
    cube.name = 'cube';
    group.add(cube);

    // Add wireframe for better visibility
    const wireframeGeometry = new THREE.BoxGeometry(
      this.config.cubeSize * 1.1, 
      this.config.cubeSize * 1.1, 
      this.config.cubeSize * 1.1
    );
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: false,  // Make solid for debugging
      opacity: 1.0        // Full opacity for debugging
    });
    const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    wireframe.name = 'wireframe';
    group.add(wireframe);

    // Add coordinate axes
    const axesGroup = this.createCoordinateAxes();
    axesGroup.name = 'axes';
    group.add(axesGroup);

    // Add marker ID label
    const idLabel = this.createTextSprite(`ID: ${markerId}`, 0xffffff);
    idLabel.position.set(0, this.config.cubeSize + 0.05, 0);
    idLabel.name = 'idLabel';
    group.add(idLabel);

    return group;
  }

  private createCoordinateAxes(): THREE.Group {
    const axesGroup = new THREE.Group();

    // X-axis (red)
    const xAxis = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      this.config.axesSize,
      0xff0000,
      this.config.axesSize * 0.2,
      this.config.axesSize * 0.1
    );
    const xLabel = this.createTextSprite('X', 0xff0000);
    xLabel.position.set(this.config.axesSize + 0.02, 0, 0);
    axesGroup.add(xAxis);
    axesGroup.add(xLabel);

    // Y-axis (green)  
    const yAxis = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      this.config.axesSize,
      0x00ff00,
      this.config.axesSize * 0.2,
      this.config.axesSize * 0.1
    );
    const yLabel = this.createTextSprite('Y', 0x00ff00);
    yLabel.position.set(0, this.config.axesSize + 0.02, 0);
    axesGroup.add(yAxis);
    axesGroup.add(yLabel);

    // Z-axis (blue)
    const zAxis = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 0),
      this.config.axesSize,
      0x0000ff,
      this.config.axesSize * 0.2,
      this.config.axesSize * 0.1
    );
    const zLabel = this.createTextSprite('Z', 0x0000ff);
    zLabel.position.set(0, 0, this.config.axesSize + 0.02);
    axesGroup.add(zAxis);
    axesGroup.add(zLabel);

    return axesGroup;
  }

  private createTextSprite(text: string, color: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;

    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      context.font = 'bold 24px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, 64, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(0.05, 0.025, 1);

    return sprite;
  }

  private updateMarkerTransform(
    group: THREE.Group, 
    marker: DetectedMarker, 
    scaleX: number, 
    scaleY: number,
    videoWidth: number,
    videoHeight: number
  ): void {
    // Start with base position (following MarkerVisualizer)
    const centerX = (0.5 - (marker.center.x / videoWidth)) * 2 * scaleX * this.config.videoScale;
    const centerY = (0.5 - (marker.center.y / videoHeight)) * 2 * scaleY * this.config.videoScale;
    const centerPos = new THREE.Vector3(centerX, centerY, -this.config.zDistance);
    
    console.log('Coordinate Debug:', {
      markerCenter: marker.center,
      videoSize: { width: videoWidth, height: videoHeight },
      scales: { scaleX, scaleY, videoScale: this.config.videoScale },
      calculatedPos: { centerX, centerY },
      finalPos: centerPos
    });

    // TEMPORARY: Keep pose disabled for coordinate debugging
    if (false && marker.pose) { // Temporarily disabled for debugging
      // Pose calculations disabled for debugging
    } else {
      console.log('Using default rotation and scale for debugging');
      // Reset rotation and scale if no pose data
      group.rotation.set(0, 0, 0);
      group.scale.setScalar(1);
      
      console.log('Scale Debug:', {
        cubeSize: this.config.cubeSize,
        axesSize: this.config.axesSize,
        baseHeight: this.config.baseHeight,
        zDistance: this.config.zDistance,
        finalScale: group.scale.x
      });
    }

    // Set final position
    group.position.copy(centerPos);
    console.log('Final marker', marker.id, 'position:', group.position, 'scale:', group.scale.x);
  }

  private disposeGroup(group: THREE.Group): void {
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
      if (object instanceof THREE.Sprite && object.material) {
        if (object.material.map) {
          object.material.map.dispose();
        }
        object.material.dispose();
      }
    });
  }

  dispose(): void {
    for (const [_, group] of this.markerGroups) {
      this.scene?.remove(group);
      this.disposeGroup(group);
    }
    this.markerGroups.clear();
    this.scene = null;
    this.videoElement = null;
  }
} 