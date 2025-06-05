import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import jsAruco from 'js-aruco';

export interface DetectedMarker {
  id: number;
  corners: { x: number; y: number }[];
  center: { x: number; y: number };
  pose?: {
    translation: THREE.Vector3;
    rotation: THREE.Euler;
    confidence: number;
  };
  poseMatrix?: THREE.Matrix4;
}

/**
 * Enhanced AR detector that integrates ArUco markers with 3D model rendering
 * 
 * ARCHITECTURE OVERVIEW:
 * - This class handles BOTH marker detection AND 3D object management
 * - Loads and positions GLTF models (keys, etc.) directly in the scene
 * - Uses POSIT algorithm for accurate pose estimation with Three.js matrices
 * - GameRenderSystem provides scene/camera but delegates AR object management here
 * - ARMarkerRenderer is now optional and used only for debug visualization (cubes, axes)
 * 
 * RESPONSIBILITIES:
 * - Marker detection using js-aruco
 * - 3D model loading (GLTF with fallback procedural models)
 * - Pose calculation and transformation matrix creation
 * - Direct 3D object positioning and lifecycle management
 * - Scene lighting for AR objects
 */
export class EnhancedARDetector {
  private detector: any; // jsAruco.AR.Detector
  private posit: any; // jsAruco.POS1.Posit
  private extractionCanvas: HTMLCanvasElement;
  private extractionCtx: CanvasRenderingContext2D;
  private readonly MARKER_SIZE_MM = 50; // Physical marker size in millimeters
  private isInitialized = false;
  
  // 3D model loading and rendering
  private gltfLoader: GLTFLoader;
  private keyModelTemplate: THREE.Object3D | null = null;
  private assetsLoaded = false;
  private arScene: THREE.Scene | null = null;
  private arCamera: THREE.Camera | null = null;
  private activeKeys: Map<number, THREE.Object3D> = new Map();
  
  // Logging function
  private logMessage: (message: string) => void;

  constructor(logMessage?: (message: string) => void) {
    this.logMessage = logMessage || console.log;
    
    // Create hidden canvas for ImageData extraction
    this.extractionCanvas = document.createElement('canvas');
    const ctx = this.extractionCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.extractionCtx = ctx;
    this.extractionCanvas.style.display = 'none';
    document.body.appendChild(this.extractionCanvas);
    
    // Initialize GLTF loader
    this.gltfLoader = new GLTFLoader();
    
    this.logMessage('EnhancedARDetector: Constructor completed');
  }

  async initialize(scene?: THREE.Scene, camera?: THREE.Camera): Promise<void> {
    try {
      // Check if js-aruco is available
      if (typeof jsAruco === 'undefined') {
        throw new Error('js-aruco library not loaded');
      }

      // Initialize detector
      // @ts-ignore - js-aruco types are not properly defined
      this.detector = new jsAruco.AR.Detector();
      
      // Initialize POSIT with default values (will update based on video dimensions)
      // @ts-ignore - js-aruco types are not properly defined
      this.posit = new jsAruco.POS1.Posit(this.MARKER_SIZE_MM, 640);
      
      // Store scene and camera references for 3D rendering
      this.arScene = scene || null;
      this.arCamera = camera || null;
      
      // Load 3D assets
      await this.loadAssets();
      
      this.isInitialized = true;
      this.logMessage('EnhancedARDetector: Initialized successfully');
    } catch (error) {
      this.logMessage(`EnhancedARDetector: Failed to initialize: ${error}`);
      throw error;
    }
  }
  
  /**
   * Load 3D assets (key.glb model)
   */
  private async loadAssets(): Promise<void> {
    try {
      this.logMessage('Loading key.glb model...');
      
      // Try to load the key model from various paths
      const paths = [
        '/key.glb',
        './key.glb',
        'key.glb',
        '/public/key.glb',
        './public/key.glb',
        'public/key.glb'
      ];
      
      let modelLoaded = false;
      
      for (const path of paths) {
        try {
          const result = await new Promise<any>((resolve, reject) => {
            this.gltfLoader.load(
              path,
              (gltf) => resolve(gltf),
              undefined,
              (error) => reject(error)
            );
          });
          
          if (result && result.scene) {
            this.logMessage(`Loaded key model from ${path}`);
            this.keyModelTemplate = result.scene.clone();
            
            // Scale the model appropriately - make it much larger and more visible
            if (this.keyModelTemplate) {
              this.keyModelTemplate.scale.set(2.0, 2.0, 2.0); // Much larger scale
              
              // Ensure all materials are visible and have proper properties
              this.keyModelTemplate.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  if (child.material) {
                    // Make sure materials are visible
                    child.material.transparent = false;
                    child.material.opacity = 1.0;
                    child.material.side = THREE.DoubleSide;
                    child.material.needsUpdate = true;
                    
                    // Add emissive color to make it glow and be more visible
                    if ('emissive' in child.material) {
                      child.material.emissive = new THREE.Color(0x444400); // Slight glow
                    }
                  }
                  child.castShadow = true;
                  child.receiveShadow = true;
                  child.visible = true;
                }
              });
              
              this.logMessage(`Key model scaled and configured for visibility`);
            }
            
            modelLoaded = true;
            break;
          }
        } catch (error) {
          this.logMessage(`Could not load key from ${path}: ${error}`);
        }
      }
      
      // If no model was loaded, create a fallback key
      if (!modelLoaded) {
        this.logMessage('Creating fallback key model');
        this.keyModelTemplate = this.createFallbackKey();
      }
      
      this.assetsLoaded = true;
      this.logMessage('3D assets loaded successfully');
      
    } catch (error) {
      this.logMessage(`Error loading 3D assets: ${error}`);
      throw error;
    }
  }
  
  /**
   * Create a fallback key model using basic geometries
   */
  private createFallbackKey(): THREE.Object3D {
    const keyGroup = new THREE.Group();
    
    // Create gold material
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x664800,
      emissiveIntensity: 0.2
    });
    
    // Create key shaft
    const shaftGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1.0, 16);
    const shaft = new THREE.Mesh(shaftGeometry, goldMaterial);
    shaft.position.y = -0.5;
    keyGroup.add(shaft);
    
    // Create key head
    const headGeometry = new THREE.BoxGeometry(0.6, 0.4, 0.2);
    const head = new THREE.Mesh(headGeometry, goldMaterial);
    head.position.y = 0.2;
    keyGroup.add(head);
    
    // Create key teeth
    const teeth1Geometry = new THREE.BoxGeometry(0.15, 0.25, 0.2);
    const teeth1 = new THREE.Mesh(teeth1Geometry, goldMaterial);
    teeth1.position.set(-0.2, -1.0, 0);
    keyGroup.add(teeth1);
    
    const teeth2Geometry = new THREE.BoxGeometry(0.15, 0.35, 0.2);
    const teeth2 = new THREE.Mesh(teeth2Geometry, goldMaterial);
    teeth2.position.set(0, -1.0, 0);
    keyGroup.add(teeth2);
    
    // Scale the fallback key
    keyGroup.scale.set(0.5, 0.5, 0.5);
    
    return keyGroup;
  }

  /**
   * Detect markers in the current video frame and render 3D models
   */
  detectMarkers(videoElement: HTMLVideoElement): DetectedMarker[] {
    if (!this.isInitialized || !this.detector) {
      this.logMessage('EnhancedARDetector: Not initialized');
      return [];
    }

    if (videoElement.readyState < 2) {
      // Video not ready
      return [];
    }

    try {
      // Extract ImageData from video
      const imageData = this.extractImageData(videoElement);
      if (!imageData) return [];

      // Update POSIT focal length based on video dimensions
      // @ts-ignore - js-aruco types are not properly defined
      this.posit = new jsAruco.POS1.Posit(this.MARKER_SIZE_MM, imageData.width);

      // Detect markers using js-aruco
      const rawMarkers = this.detector.detect(imageData);
      
      // Convert to our marker format
      const detectedMarkers = rawMarkers.map((rawMarker: any) => this.convertMarker(rawMarker, imageData));
      
      // Update 3D models based on detected markers
      this.updateARModels(detectedMarkers);
      
      return detectedMarkers;
    } catch (error) {
      this.logMessage(`EnhancedARDetector: Detection failed: ${error}`);
      return [];
    }
  }
  
  /**
   * Calculate distance-based scale factor for the key (from reference implementation)
   */
  private calculateDistanceScale(marker: DetectedMarker, videoElement: HTMLVideoElement): number {
    let distanceScale = 1.0;
    
    // Method 1: Use pose translation Z if available (most accurate)
    if (marker.pose && marker.pose.translation) {
      const zDistance = Math.abs(marker.pose.translation.z * 1000); // Convert back to mm
      // Scale inversely with distance - closer markers get bigger keys
      // Normalize distance to a reasonable scale (assuming 50-500mm typical range)
      const normalizedDistance = Math.max(50, Math.min(500, zDistance));
      distanceScale = 500 / normalizedDistance; // Inverse relationship
      
      this.logMessage(`Marker ${marker.id} Z-distance: ${zDistance.toFixed(2)}mm, scale: ${distanceScale.toFixed(2)}`);
    } 
    // Method 2: Use marker apparent size as distance proxy (fallback)
    else if (marker.corners && marker.corners.length >= 4) {
      // Calculate marker area from corners
      const bounds = this.calculateBounds(marker.corners);
      const markerArea = bounds.width * bounds.height;
      const videoArea = (videoElement.videoWidth || 640) * (videoElement.videoHeight || 480);
      const relativeSize = markerArea / videoArea;
      
      // Scale based on relative marker size
      // Typical marker might be 1-10% of screen area
      const minRelativeSize = 0.001; // Very far
      const maxRelativeSize = 0.1;   // Very close
      const clampedSize = Math.max(minRelativeSize, Math.min(maxRelativeSize, relativeSize));
      
      // Logarithmic scaling for natural distance perception
      distanceScale = Math.pow(clampedSize / minRelativeSize, 0.3);
      
      this.logMessage(`Marker ${marker.id} relative size: ${(relativeSize * 100).toFixed(2)}%, scale: ${distanceScale.toFixed(2)}`);
    }
    
    // Clamp scale to reasonable bounds
    return Math.max(0.2, Math.min(3.0, distanceScale));
  }

  /**
   * Calculate marker bounds from corners
   */
  private calculateBounds(corners: { x: number; y: number }[]): { width: number; height: number; minX: number; maxX: number; minY: number; maxY: number } {
    const xs = corners.map(c => c.x);
    const ys = corners.map(c => c.y);
    
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
  }

  /**
   * Calculate the scale and position to fit the key within marker bounds
   */
  private calculateMarkerConstraints(marker: DetectedMarker, videoElement: HTMLVideoElement): { scale: number; distanceScale: number; bounds?: any } {
    if (!marker.corners || marker.corners.length < 4) {
      return { scale: 1, distanceScale: 1 };
    }

    // Calculate marker dimensions in 2D space
    const bounds = this.calculateBounds(marker.corners);
    
    // Use marker size to determine appropriate scale
    // Assuming marker is roughly square, use the smaller dimension
    const markerSize = Math.min(bounds.width, bounds.height);
    
    // Scale factor to keep key within marker bounds (with some padding)
    const maxKeySize = markerSize * 0.12; // 12% of marker size (same as reference)
    const keyScale = maxKeySize / 90; // Divide by 90 to get the right scale (same as reference)
    
    // Calculate distance-based scale
    const distanceScale = this.calculateDistanceScale(marker, videoElement);
    
    return {
      scale: Math.max(keyScale, 0.1), // Minimum scale to ensure visibility
      distanceScale: distanceScale,
      bounds: bounds
    };
  }

  /**
   * Convert 2D marker coordinates to 3D position using perspective transformation
   */
  private markerTo3DPosition(marker: DetectedMarker, videoElement: HTMLVideoElement, depth: number = -1.0): THREE.Vector3 {
    if (!marker.center) {
      return new THREE.Vector3(0, 0, depth);
    }

    // Convert from screen coordinates to normalized device coordinates
    const videoWidth = videoElement.videoWidth || 640;
    const videoHeight = videoElement.videoHeight || 480;
    
    // Normalize coordinates to [-1, 1] range
    const normalizedX = (marker.center.x / videoWidth) * 2 - 1;
    const normalizedY = -((marker.center.y / videoHeight) * 2 - 1); // Flip Y axis
    
    // Convert to world coordinates based on camera position and field of view
    const aspectRatio = videoWidth / videoHeight;
    const fov = 75 * Math.PI / 180; // Assume 75 degree FOV, convert to radians
    const distance = Math.abs(depth);
    
    const worldY = Math.tan(fov / 2) * distance * normalizedY;
    const worldX = worldY * aspectRatio * normalizedX;
    
    return new THREE.Vector3(worldX, worldY, depth);
  }

  /**
   * Update 3D models based on detected markers
   */
  public updateARModels(markers: DetectedMarker[]): void {
    if (!this.arScene || !this.assetsLoaded || !this.keyModelTemplate) {
      return;
    }
    
    const currentMarkerIds = new Set<number>();
    
    // Process each detected marker
    markers.forEach(marker => {
      currentMarkerIds.add(marker.id);
      
      // Only show key for marker ID 1 (changed from ID 0)
      if (marker.id === 1) {
        let keyObject = this.activeKeys.get(marker.id);
        
        // Create key object if it doesn't exist
        if (!keyObject && this.keyModelTemplate) {
          keyObject = this.keyModelTemplate.clone();
          keyObject.name = `ar-key-${marker.id}`;
          if (this.arScene) {
            this.arScene.add(keyObject);
          }
          this.activeKeys.set(marker.id, keyObject);
          this.logMessage(`Created key object for marker ${marker.id}`);
        }
        
        // Always show and position the key
        if (keyObject) {
          keyObject.visible = true;
          
          try {
            // Get video element for calculations (need to find it from the scene context)
            // For now, assume 640x480 default, but this could be improved with actual video reference
            const mockVideoElement = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
            
            // Calculate constraints based on marker corners and distance
            const constraints = this.calculateMarkerConstraints(marker, mockVideoElement);
            
            // Position the key based on marker center and constraints
            let position: THREE.Vector3;
            
            if (marker.poseMatrix) {
              // Use pose matrix if available for accurate 3D positioning
              const matrix = new THREE.Matrix4().fromArray(marker.poseMatrix.elements);
              const pos = new THREE.Vector3();
              const quaternion = new THREE.Quaternion();
              const scale = new THREE.Vector3();
              matrix.decompose(pos, quaternion, scale);
              
              // Apply constraints to keep key within reasonable bounds
              pos.multiplyScalar(0.01); // Bring it closer
              pos.z = Math.max(pos.z, -4.0); // Don't go too far back
              pos.z = Math.min(pos.z, -0.3); // Don't come too close
              
              position = pos;
              keyObject.quaternion.copy(quaternion);
              
              this.logMessage(`Using pose matrix positioning for marker ${marker.id}`);
            } else {
              // Fallback to 2D-to-3D conversion using marker center
              position = this.markerTo3DPosition(marker, mockVideoElement, -1.5);
              this.logMessage(`Using fallback 2D-to-3D positioning for marker ${marker.id}`);
            }
            
            // Apply position
            keyObject.position.copy(position);
            
            // Apply constrained scale based on marker size AND distance (same as reference)
            const keyScaleOption = 2.0; // Increased from 0.5 to make keys more visible
            const baseScale = constraints.scale * keyScaleOption;
            const finalScale = baseScale * constraints.distanceScale; // Apply distance scaling
            
            // Apply the scale directly (no additional clamping beyond what's in constraints)
            keyObject.scale.set(finalScale, finalScale, finalScale);
            
            // Optional: Add slight rotation for visual effect, but keep it subtle
            keyObject.rotation.y += 0.005; // Slower rotation to avoid distraction
            
            // Make sure matrix auto-update is enabled for proper rendering
            keyObject.matrixAutoUpdate = true;
            
            // Log positioning info for debugging
            this.logMessage(`Key ${marker.id} positioned at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}) with scale ${finalScale.toFixed(2)} (base: ${baseScale.toFixed(2)}, distance: ${constraints.distanceScale.toFixed(2)})`);
            
          } catch (err) {
            this.logMessage(`Error positioning key: ${err instanceof Error ? err.message : String(err)}`);
            
            // Fallback: simple positioning
            const centerX = (marker.center.x - 320) / 320; // Normalize to [-1, 1]
            const centerY = -(marker.center.y - 240) / 240; // Normalize and flip Y
            keyObject.position.set(centerX * 2, centerY * 2, -2.0);
            keyObject.scale.set(5.6, 5.6, 5.6);
            keyObject.matrixAutoUpdate = true;
          }
          
          this.logMessage(`Key is visible and positioned for marker ${marker.id}`);
        }
      }
    });
    
    // Remove keys for markers that are no longer detected
    for (const [markerId, keyObject] of this.activeKeys.entries()) {
      if (!currentMarkerIds.has(markerId)) {
        if (keyObject && this.arScene) {
          this.arScene.remove(keyObject);
          this.activeKeys.delete(markerId);
          this.logMessage(`Removed key object for marker ${markerId}`);
        }
      }
    }
  }

  /**
   * Extract ImageData from video element
   */
  private extractImageData(videoElement: HTMLVideoElement): ImageData | null {
    try {
      const width = videoElement.videoWidth;
      const height = videoElement.videoHeight;

      if (width === 0 || height === 0) {
        return null;
      }

      // Update canvas size if needed
      if (this.extractionCanvas.width !== width || this.extractionCanvas.height !== height) {
        this.extractionCanvas.width = width;
        this.extractionCanvas.height = height;
      }

      // Draw video frame to canvas
      this.extractionCtx.drawImage(videoElement, 0, 0, width, height);
      
      // Extract ImageData
      return this.extractionCtx.getImageData(0, 0, width, height);
    } catch (error) {
      this.logMessage(`EnhancedARDetector: Failed to extract ImageData: ${error}`);
      return null;
    }
  }

  /**
   * Convert raw js-aruco marker to our format with enhanced pose matrix
   */
  private convertMarker(rawMarker: any, imageData: ImageData): DetectedMarker {
    // Extract corners
    const corners = rawMarker.corners.map((corner: any) => ({
      x: corner.x,
      y: corner.y
    }));

    // Calculate center
    const center = {
      x: corners.reduce((sum: number, corner: { x: number; y: number }) => sum + corner.x, 0) / 4,
      y: corners.reduce((sum: number, corner: { x: number; y: number }) => sum + corner.y, 0) / 4
    };

    // Calculate pose using POSIT
    let pose: DetectedMarker['pose'];
    let poseMatrix: THREE.Matrix4 | undefined;
    
    try {
      // Center corners for POSIT (move origin to center, flip Y)
      const centeredCorners = corners.map((corner: { x: number; y: number }) => ({
        x: corner.x - (imageData.width / 2),
        y: (imageData.height / 2) - corner.y
      }));

      const rawPose = this.posit.pose(centeredCorners);
      
      // Convert to Three.js format
      pose = {
        translation: new THREE.Vector3(
          rawPose.bestTranslation[0] / 100, // Convert mm to meters
          rawPose.bestTranslation[1] / 100,
          rawPose.bestTranslation[2] / 100
        ),
        rotation: this.matrixToEuler(rawPose.bestRotation),
        confidence: 1.0 / (1.0 + rawPose.bestError) // Convert error to confidence
      };
      
      // Create 4x4 transformation matrix for 3D rendering
      poseMatrix = new THREE.Matrix4();
      
      // Set rotation matrix (3x3 to 4x4)
      const rotation = rawPose.bestRotation;
      const translation = rawPose.bestTranslation;
      
      // Create a proper transformation matrix
      // Note: js-aruco returns rotation matrix in row-major order
      // Use actual distance for dynamic scaling
      const scaleFactor = 0.01; // Scale down translation for positioning
      const actualZ = -Math.abs(translation[2]) * scaleFactor; // Use actual Z distance (make it negative for camera space)
      
      poseMatrix.set(
        rotation[0][0], rotation[1][0], rotation[2][0], translation[0] * scaleFactor,
        rotation[0][1], rotation[1][1], rotation[2][1], translation[1] * scaleFactor,
        rotation[0][2], rotation[1][2], rotation[2][2], actualZ, // Use actual distance
        0, 0, 0, 1
      );
      
      this.logMessage(`Pose matrix for marker ${rawMarker.id}: T[${(translation[0] * scaleFactor).toFixed(2)}, ${(translation[1] * scaleFactor).toFixed(2)}, ${actualZ.toFixed(2)}] Distance: ${Math.abs(translation[2]).toFixed(0)}mm`);
      
    } catch (error) {
      this.logMessage(`EnhancedARDetector: Failed to calculate pose for marker ${rawMarker.id}: ${error}`);
    }

    return {
      id: rawMarker.id,
      corners,
      center,
      pose,
      poseMatrix
    };
  }

  /**
   * Convert 3x3 rotation matrix to Euler angles
   */
  private matrixToEuler(matrix: number[][]): THREE.Euler {
    const threeMatrix = new THREE.Matrix3();
    threeMatrix.set(
      matrix[0][0], matrix[0][1], matrix[0][2],
      matrix[1][0], matrix[1][1], matrix[1][2],
      matrix[2][0], matrix[2][1], matrix[2][2]
    );
    
    const euler = new THREE.Euler();
    euler.setFromRotationMatrix(new THREE.Matrix4().setFromMatrix3(threeMatrix));
    return euler;
  }
  
  /**
   * Set the rendering context (scene and camera) for 3D models
   */
  setRenderingContext(scene: THREE.Scene, camera: THREE.Camera): void {
    this.arScene = scene;
    this.arCamera = camera;
    
    // Add proper lighting to make the key visible
    if (this.arScene) {
      // Add ambient light for general illumination
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      ambientLight.name = 'ar-ambient-light';
      this.arScene.add(ambientLight);
      
      // Add directional light for better visibility
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
      directionalLight.position.set(1, 1, 1);
      directionalLight.name = 'ar-directional-light';
      this.arScene.add(directionalLight);
      
      // Add point light at camera position
      const pointLight = new THREE.PointLight(0xffffff, 0.5);
      pointLight.position.set(0, 0, 0);
      pointLight.name = 'ar-point-light';
      this.arScene.add(pointLight);
    }
    
    this.logMessage('EnhancedARDetector: Rendering context set with lighting');
  }
  
  /**
   * Clean up all AR objects from the scene
   */
  clearARObjects(): void {
    if (this.arScene) {
      // Remove all active keys
      this.activeKeys.forEach((keyObject) => {
        if (keyObject) {
          this.arScene!.remove(keyObject);
        }
      });
      this.activeKeys.clear();
      
      // Remove AR lights
      const lightsToRemove = this.arScene.children.filter(child => 
        child.name && child.name.startsWith('ar-')
      );
      lightsToRemove.forEach(light => this.arScene!.remove(light));
      
      this.logMessage('EnhancedARDetector: Cleared all AR objects and lighting');
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.clearARObjects();
    
    if (this.extractionCanvas && this.extractionCanvas.parentNode) {
      this.extractionCanvas.parentNode.removeChild(this.extractionCanvas);
    }
    
    this.isInitialized = false;
    this.assetsLoaded = false;
    this.arScene = null;
    this.arCamera = null;
    this.keyModelTemplate = null;
    
    this.logMessage('EnhancedARDetector: Disposed');
  }
} 