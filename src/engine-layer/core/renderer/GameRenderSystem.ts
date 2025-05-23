import * as THREE from 'three';

export class GameRenderSystem {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private trailLine: THREE.Line | null = null;
  private trailGeometry: THREE.BufferGeometry | null = null;
  private trailPointsRef: THREE.Vector3[] = [];
  private readonly MAX_TRAIL_POINTS = 50;
  
  // Ground plane references
  private ground: THREE.Mesh | null = null;
  private groundSize = 500; // Extended from 20 to 500
  private lastCameraPosition = new THREE.Vector3();
  private groundRepositionThreshold = 100; // Reposition when within 100 units of edge

  // Fog for distance perception
  private fogColor = 0xccccff; // Slight blue tint
  private fogNear = 200;
  private fogFar = 500;

  initialize(canvas: HTMLCanvasElement): void {
    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue background
    
    // Add fog for distance perception
    this.scene.fog = new THREE.Fog(this.fogColor, this.fogNear, this.fogFar);
    
    // Setup camera with extended viewing distance
    this.camera = new THREE.PerspectiveCamera(
      75, // Field of view
      window.innerWidth / window.innerHeight,
      0.1,
      1000 // Increased from default to see distant objects
    );
    this.camera.position.set(0, 1, 0); // Start at origin, eye level
    this.lastCameraPosition.copy(this.camera.position);
    
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
    
    // Extend shadow camera to cover larger ground
    directionalLight.shadow.camera.left = -this.groundSize / 4;
    directionalLight.shadow.camera.right = this.groundSize / 4;
    directionalLight.shadow.camera.top = this.groundSize / 4;
    directionalLight.shadow.camera.bottom = -this.groundSize / 4;
    directionalLight.shadow.camera.far = 1000;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    
    this.scene.add(directionalLight);
    
    // Add extended ground plane
    this.createGround();

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

    // Add distant objects for testing
    this.addDistantObjects();

    // Add a trail visualization line with pre-allocated buffer
    const trailMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    this.trailGeometry = new THREE.BufferGeometry();
    
    // Pre-allocate position buffer for MAX_TRAIL_POINTS
    const positions = new Float32Array(this.MAX_TRAIL_POINTS * 3);
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.trailGeometry.setDrawRange(0, 0); // Initially draw 0 points
    
    this.trailLine = new THREE.Line(this.trailGeometry, trailMaterial);
    this.scene.add(this.trailLine);
  }

  // New method to create ground with tiled texture
  private createGround(): void {
    if (!this.scene) return;

    // Remove existing ground if it exists
    if (this.ground) {
      this.scene.remove(this.ground);
    }

    const groundGeometry = new THREE.PlaneGeometry(this.groundSize, this.groundSize, 64, 64);
    
    // Replace texture loading with procedural grid texture
    // Create a procedural grid texture instead of loading an external file
    const gridSize = 1024;
    let groundMaterial: THREE.MeshStandardMaterial;

    try {
      const gridTexture = this.createGridTexture(gridSize);
      groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x808080,
        roughness: 0.8,
        metalness: 0.2,
        map: gridTexture
      });
    } catch (error) {
      console.warn('Failed to create grid texture, using untextured material', error);
      groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x808080,
        roughness: 0.8,
        metalness: 0.2
      });
    }
    
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }

  // New method to add distant objects for testing
  private addDistantObjects(): void {
    if (!this.scene) return;
    
    // Add some mountains in the distance
    const mountainGeometry = new THREE.ConeGeometry(10, 20, 4);
    const mountainMaterial = new THREE.MeshStandardMaterial({ color: 0x6a7a8e });
    
    // Create several mountains at different distances
    const mountainPositions = [
      { x: -80, z: -150, scale: 5 },
      { x: 100, z: -200, scale: 8 },
      { x: -150, z: -250, scale: 10 },
      { x: 50, z: -300, scale: 7 },
      { x: -200, z: -350, scale: 12 }
    ];
    
    mountainPositions.forEach(pos => {
      const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
      mountain.position.set(pos.x, pos.scale * 10 / 2, pos.z);
      mountain.scale.set(pos.scale, pos.scale, pos.scale);
      mountain.castShadow = true;
      if (this.scene) {
        this.scene.add(mountain);
      }
    });
    
    // Add some distant trees
    const treeGeometry = new THREE.ConeGeometry(1, 4, 6);
    const treeTrunkGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1, 6);
    const treeLeavesMaterial = new THREE.MeshStandardMaterial({ color: 0x2d4c1e });
    const treeTrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2817 });
    
    // Create trees at different distances
    for (let i = 0; i < 50; i++) {
      // Create tree group
      const treeGroup = new THREE.Group();
      
      // Create leaves
      const leaves = new THREE.Mesh(treeGeometry, treeLeavesMaterial);
      leaves.position.y = 2.5;
      leaves.castShadow = true;
      treeGroup.add(leaves);
      
      // Create trunk
      const trunk = new THREE.Mesh(treeTrunkGeometry, treeTrunkMaterial);
      trunk.position.y = 0.5;
      trunk.castShadow = true;
      treeGroup.add(trunk);
      
      // Position tree at random location in the distance
      const angle = Math.random() * Math.PI * 2;
      const distance = 100 + Math.random() * 200; // Between 100 and 300 units away
      const x = Math.sin(angle) * distance;
      const z = Math.cos(angle) * distance;
      
      treeGroup.position.set(x, 0, z);
      if (this.scene) {
        this.scene.add(treeGroup);
      }
    }
  }

  updateCamera(position: THREE.Vector3, rotation: number, velocityMagnitude: number): void {
    if (!this.camera || !this.ground) return;
    
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
    
    // Check if we need to reposition the ground plane
    this.checkGroundRepositioning();
  }

  // New method to reposition ground when approaching edges
  private checkGroundRepositioning(): void {
    if (!this.camera || !this.ground) return;
    
    const cameraPosition = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPosition);
    
    // Only check every few frames for performance
    if (cameraPosition.distanceTo(this.lastCameraPosition) < 5) {
      return;
    }
    
    this.lastCameraPosition.copy(cameraPosition);
    
    // Calculate distance from center in xz plane
    const distanceFromCenter = Math.sqrt(
      cameraPosition.x * cameraPosition.x + 
      cameraPosition.z * cameraPosition.z
    );
    
    // If camera is approaching edge of ground, reposition ground
    if (distanceFromCenter > (this.groundSize / 2) - this.groundRepositionThreshold) {
      // Reposition ground to be centered at camera xz position
      this.ground.position.x = cameraPosition.x;
      this.ground.position.z = cameraPosition.z;
      
      // Log for debugging
      console.log('Repositioned ground plane to', { 
        x: this.ground.position.x, 
        z: this.ground.position.z 
      });
    }
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
      
      // Update the pre-allocated buffer with current trail points
      const positionAttribute = this.trailGeometry.getAttribute('position') as THREE.BufferAttribute;
      const positions = positionAttribute.array as Float32Array;
      
      // Fill the position buffer with current trail points
      for (let i = 0; i < this.trailPointsRef.length; i++) {
        const point = this.trailPointsRef[i];
        positions[i * 3] = point.x;
        positions[i * 3 + 1] = point.y;
        positions[i * 3 + 2] = point.z;
      }
      
      // Mark the attribute as needing update
      positionAttribute.needsUpdate = true;
      
      // Set draw range to only render the points we have
      this.trailGeometry.setDrawRange(0, this.trailPointsRef.length);
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
    this.ground = null;
  }

  // Add the createGridTexture method later in the class
  private createGridTexture(size: number): THREE.Texture {
    // Create a canvas element to draw the grid on
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    
    const context = canvas.getContext('2d');
    if (!context) {
      console.error('Could not get 2D context for grid texture');
      // Return a basic placeholder texture
      return new THREE.Texture();
    }
    
    // Fill the background
    context.fillStyle = '#808080';
    context.fillRect(0, 0, size, size);
    
    // Draw a grid
    const gridStep = size / 10;
    context.strokeStyle = '#666666';
    context.lineWidth = 1;
    
    // Draw horizontal lines
    for (let i = 0; i <= size; i += gridStep) {
      context.beginPath();
      context.moveTo(0, i);
      context.lineTo(size, i);
      context.stroke();
    }
    
    // Draw vertical lines
    for (let i = 0; i <= size; i += gridStep) {
      context.beginPath();
      context.moveTo(i, 0);
      context.lineTo(i, size);
      context.stroke();
    }
    
    // Draw main axes as thicker lines
    context.strokeStyle = '#444444';
    context.lineWidth = 3;
    
    // Horizontal center line
    context.beginPath();
    context.moveTo(0, size / 2);
    context.lineTo(size, size / 2);
    context.stroke();
    
    // Vertical center line
    context.beginPath();
    context.moveTo(size / 2, 0);
    context.lineTo(size / 2, size);
    context.stroke();
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(this.groundSize / 20, this.groundSize / 20);
    texture.anisotropy = 16;
    
    return texture;
  }

  getGroundPosition(): { x: number, z: number } | null {
    if (!this.ground) return null;
    return {
      x: this.ground.position.x,
      z: this.ground.position.z
    };
  }
} 