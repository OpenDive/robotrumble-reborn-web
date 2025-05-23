import * as THREE from 'three';

export class GameRenderSystem {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private trailLine: THREE.Line | null = null;
  private trailGeometry: THREE.BufferGeometry | null = null;
  private trailPointsRef: THREE.Vector3[] = [];
  private readonly MAX_TRAIL_POINTS = 50;

  initialize(canvas: HTMLCanvasElement): void {
    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue background
    
    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      75, // Field of view
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1, 0); // Start at origin, eye level
    
    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
    
    // Add ground plane
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x808080,
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Add target cube
    const targetGeometry = new THREE.BoxGeometry(1, 1, 1);
    const targetMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    const targetMesh = new THREE.Mesh(targetGeometry, targetMaterial);
    targetMesh.position.set(0, 0.5, -5); // Place it 5 units ahead
    targetMesh.castShadow = true;
    this.scene.add(targetMesh);

    // Add track boundaries (simple walls for now)
    const wallGeometry = new THREE.BoxGeometry(1, 1, 20);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    
    // Left wall
    const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
    leftWall.position.set(-5, 0.5, 0);
    leftWall.castShadow = true;
    this.scene.add(leftWall);
    
    // Right wall
    const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
    rightWall.position.set(5, 0.5, 0);
    rightWall.castShadow = true;
    this.scene.add(rightWall);

    // Add a trail visualization line
    const trailMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailLine = new THREE.Line(this.trailGeometry, trailMaterial);
    this.scene.add(this.trailLine);
  }

  updateCamera(position: THREE.Vector3, rotation: number, velocityMagnitude: number): void {
    if (!this.camera) return;
    
    // Calculate target position
    const targetPosition = new THREE.Vector3(
      position.x - Math.sin(rotation) * 0.3, // Position slightly behind
      position.y + 0.5, // Slightly above the capsule
      position.z - Math.cos(rotation) * 0.3  // Position slightly behind
    );
    
    // Get current camera position
    const currentPosition = new THREE.Vector3();
    this.camera.getWorldPosition(currentPosition);
    
    // Apply smooth lerping to camera position with a more consistent factor
    // Use a base smoothing factor that's less dependent on velocity
    const baseSmoothFactor = 0.12;
    // Add a small velocity influence but with less impact than before
    const velocityInfluence = Math.min(0.02, velocityMagnitude * 0.005);
    // Final lerp factor has a stable base with subtle velocity influence
    const positionLerpFactor = baseSmoothFactor - velocityInfluence;
    
    currentPosition.lerp(targetPosition, positionLerpFactor);
    this.camera.position.copy(currentPosition);
    
    // Smoothly interpolate camera rotation with the same consistent approach
    const currentRotation = this.camera.rotation.y;
    const targetRotation = rotation;
    const rotationLerpFactor = 0.08; // Slightly increased for smoother rotation
    this.camera.rotation.y = currentRotation + (targetRotation - currentRotation) * rotationLerpFactor;
  }

  updateTrail(position: THREE.Vector3): void {
    if (!this.trailGeometry) return;
    
    const newPoint = new THREE.Vector3(
      position.x, 
      position.y + 0.1, 
      position.z
    );
    
    // Only add points if moved enough to be visible
    const lastPoint = this.trailPointsRef.length > 0 ? 
      this.trailPointsRef[this.trailPointsRef.length - 1] : null;
    
    if (!lastPoint || lastPoint.distanceTo(newPoint) > 0.2) {
      this.trailPointsRef.push(newPoint);
      
      // Limit trail length
      if (this.trailPointsRef.length > this.MAX_TRAIL_POINTS) {
        this.trailPointsRef.shift();
      }
      
      // Update line geometry
      this.trailGeometry.setFromPoints(this.trailPointsRef);
    }
  }

  handleCollisionFeedback(isColliding: boolean): void {
    if (!this.scene) return;
    
    if (isColliding) {
      const walls = this.scene.children.filter(child => 
        child instanceof THREE.Mesh && 
        child.material instanceof THREE.MeshStandardMaterial &&
        child.position.y === 0.5
      ) as THREE.Mesh[];
      
      walls.forEach(wall => {
        const material = wall.material as THREE.MeshStandardMaterial;
        material.emissive.setHex(0x330000);
        setTimeout(() => material.emissive.setHex(0x000000), 100);
      });
    }
  }

  render(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    if (!this.camera || !this.renderer) return;
    
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose(): void {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    
    this.scene = null;
    this.camera = null;
    this.trailLine = null;
    this.trailGeometry = null;
    this.trailPointsRef = [];
  }
} 