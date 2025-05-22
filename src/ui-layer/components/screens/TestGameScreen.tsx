import React, { useEffect, useRef, useState } from 'react';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import styles from './TestGameScreen.module.css';

interface GameState {
  position: THREE.Vector3;
  rotation: number;
  velocity: THREE.Vector2;
  isColliding: boolean;
}

export const TestGameScreen: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  
  // Create a ref for keys instead of state
  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false
  });
  
  // Keep the state for UI rendering
  const [keys, setKeys] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false
  });
  
  // Game state
  const [gameState, setGameState] = useState<GameState>({
    position: new THREE.Vector3(0, 1, 0),
    rotation: 0,
    velocity: new THREE.Vector2(0, 0),
    isColliding: false
  });
  
  // Physics refs
  const worldRef = useRef<RAPIER.World | null>(null);
  const playerBodyRef = useRef<RAPIER.RigidBody | null>(null);
  
  // Add state for visualization trail points
  const trailPointsRef = useRef<THREE.Vector3[]>([]);
  const MAX_TRAIL_POINTS = 50;
  
  // Initialize physics world
  useEffect(() => {
    let world: RAPIER.World | null = null;
    let cleanup = false;
    
    const initPhysics = async () => {
      await RAPIER.init();
      
      if (cleanup) return;
      
      // Create physics world
      world = new RAPIER.World({x: 0.0, y: -9.81, z: 0.0});
      worldRef.current = world;
      
      // Create ground collider
      const groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 0.1, 10.0);
      world.createCollider(groundColliderDesc);
      
      // Create walls
      const wallColliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 10.0);
      
      // Left wall
      wallColliderDesc.setTranslation(-5, 0.5, 0);
      world.createCollider(wallColliderDesc);
      
      // Right wall
      wallColliderDesc.setTranslation(5, 0.5, 0);
      world.createCollider(wallColliderDesc);
      
      // Create player rigid body
      const playerBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, 1, 0)
        .setLinearDamping(3.0) // Increased from 1.5 to 3.0 for better stopping
        .setAngularDamping(0.5);
      
      const playerBody = world.createRigidBody(playerBodyDesc);
      
      // Create player collider (capsule for better movement)
      const playerColliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.2); // height, radius
      world.createCollider(playerColliderDesc, playerBody);
      
      playerBodyRef.current = playerBody;
      
      // Lock rotation except around Y axis
      playerBody.setEnabledRotations(false, true, false, true);
    };
    
    initPhysics();
    
    return () => {
      cleanup = true;
      if (world) {
        // Clean up physics objects
        playerBodyRef.current = null;
        worldRef.current = null;
        world.free();
      }
    };
  }, []);
  
  useEffect(() => {
    console.log('Initializing scene...');
    if (!canvasRef.current) {
      console.log('No canvas ref, skipping initialization');
      return;
    }
    
    // Focus the canvas so it can receive keyboard events
    canvasRef.current.focus();
    console.log('Canvas focused:', document.activeElement === canvasRef.current);

    // Initialize Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue background
    
    // Setup camera
    const camera = new THREE.PerspectiveCamera(
      75, // Field of view
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1, 0); // Start at origin, eye level
    
    // Setup renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
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
    scene.add(ground);
    
    // Player is not visible in first-person mode

    // Add target cube
    const targetGeometry = new THREE.BoxGeometry(1, 1, 1);
    const targetMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    const targetMesh = new THREE.Mesh(targetGeometry, targetMaterial);
    targetMesh.position.set(0, 0.5, -5); // Place it 5 units ahead
    targetMesh.castShadow = true;
    scene.add(targetMesh);

    // Add track boundaries (simple walls for now)
    const wallGeometry = new THREE.BoxGeometry(1, 1, 20);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    
    // Left wall
    const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
    leftWall.position.set(-5, 0.5, 0);
    leftWall.castShadow = true;
    scene.add(leftWall);
    
    // Right wall
    const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
    rightWall.position.set(5, 0.5, 0);
    rightWall.castShadow = true;
    scene.add(rightWall);

    // Add a trail visualization line
    const trailMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    const trailGeometry = new THREE.BufferGeometry();
    const trailLine = new THREE.Line(trailGeometry, trailMaterial);
    scene.add(trailLine);

    // Store refs for cleanup
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // Handle keyboard input - attach to document instead of canvas
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if typing in an input field
      if ((event.target as HTMLElement)?.tagName === 'INPUT' || 
          (event.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }
      
      event.preventDefault();
      let newKeys = { ...keysRef.current };
      
      switch(event.code) {
        case 'ArrowUp':
        case 'KeyW':
          newKeys.forward = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
          newKeys.backward = true;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          newKeys.left = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
          newKeys.right = true;
          break;
      }
      
      // Update the ref immediately
      keysRef.current = newKeys;
      
      // Only update state if keys changed
      if (JSON.stringify(newKeys) !== JSON.stringify(keys)) {
        console.log('%cKeys:', 'color: #2196F3; font-weight: bold', newKeys);
        setKeys(newKeys);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // Skip if typing in an input field
      if ((event.target as HTMLElement)?.tagName === 'INPUT' || 
          (event.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }
      
      event.preventDefault();
      let newKeys = { ...keysRef.current };
      
      switch(event.code) {
        case 'ArrowUp':
        case 'KeyW':
          newKeys.forward = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          newKeys.backward = false;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          newKeys.left = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          newKeys.right = false;
          break;
      }
      
      // Update the ref immediately
      keysRef.current = newKeys;
      
      // Only update state if keys changed
      if (JSON.stringify(newKeys) !== JSON.stringify(keys)) {
        console.log('%cKeys:', 'color: #2196F3; font-weight: bold', newKeys);
        setKeys(newKeys);
      }
    };

    // Attach event listeners to document instead of canvas
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Focus the canvas when clicking on it
    const handleCanvasClick = () => {
      if (canvasRef.current) {
        canvasRef.current.focus();
        console.log('Canvas clicked and focused');
      }
    };
    
    const canvas = canvasRef.current;
    canvas.addEventListener('click', handleCanvasClick);

    // Animation loop
    let lastTime = 0;
    let animationFrameId: number;
    let frameCount = 0;
    
    const animate = (time: number) => {
      // Request next frame first
      animationFrameId = requestAnimationFrame(animate);
      
      // Debug animation and physics state every 60 frames
      if (frameCount % 60 === 0) {
        console.log('%cFrame:', 'color: #4CAF50; font-weight: bold', {
          number: frameCount,
          physics: {
            world: worldRef.current ? 'exists' : 'null',
            playerBody: playerBodyRef.current ? 'exists' : 'null'
          }
        });
      }
      frameCount++;
      
      const deltaTime = (time - lastTime) / 1000; // Convert to seconds
      lastTime = time;
      
      // Update physics world
      if (worldRef.current && playerBodyRef.current) {
        const world = worldRef.current;
        const playerBody = playerBodyRef.current;
        
        // Step the physics world
        world.step();
        
        // Get current physics state
        const physicsState = {
          position: playerBody.translation(),
          velocity: playerBody.linvel()
        };
        
        // Only debug log if there's movement or key input
        const isMoving = Object.values(keysRef.current).some(key => key) || 
                        Math.abs(physicsState.velocity.x) > 0.1 || 
                        Math.abs(physicsState.velocity.z) > 0.1;
        
        if (isMoving) {
          console.log('%cState:', 'color: #4CAF50; font-weight: bold', {
            keys: keysRef.current,
            position: {
              x: physicsState.position.x.toFixed(2),
              y: physicsState.position.y.toFixed(2),
              z: physicsState.position.z.toFixed(2)
            },
            velocity: {
              x: physicsState.velocity.x.toFixed(2),
              y: physicsState.velocity.y.toFixed(2),
              z: physicsState.velocity.z.toFixed(2)
            }
          });
        }
        
        // Handle rotation first
        let newRotation = gameState.rotation;
        const rotationSpeed = 3.0;
        if (keysRef.current.left) newRotation += rotationSpeed * deltaTime;
        if (keysRef.current.right) newRotation -= rotationSpeed * deltaTime;
        
        // Handle movement
        const speed = 8.0; 
        const maxVelocity = 3.0; // Maximum velocity
        const moveDirection = new THREE.Vector3(0, 0, 0);
        
        if (keysRef.current.forward) moveDirection.z = -1; // Forward
        if (keysRef.current.backward) moveDirection.z = 1;  // Backward
        
        // Get physics state for camera and state updates regardless of movement
        const pos = playerBody.translation();
        const currentVel = playerBody.linvel();
        const velocityMagnitude = Math.sqrt(
          currentVel.x * currentVel.x + 
          currentVel.z * currentVel.z
        );
        
        // CHANGED: Use velocity-based control instead of force-based
        // This ensures the player stops when keys are released
        if (keysRef.current.forward || keysRef.current.backward) {
          // Apply rotation to movement vector
          moveDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), newRotation);
          
          // Calculate target velocity instead of force
          const targetVelocity = {
            x: moveDirection.x * speed,
            y: 0,
            z: moveDirection.z * speed
          };
          
          // Smoothly interpolate current velocity toward target velocity
          const lerpFactor = 0.2; // How quickly to reach target velocity
          const newVelocity = {
            x: currentVel.x + (targetVelocity.x - currentVel.x) * lerpFactor,
            y: currentVel.y,
            z: currentVel.z + (targetVelocity.z - currentVel.z) * lerpFactor
          };
          
          // Apply velocity clamping to prevent excessive speed
          const newVelocityMagnitude = Math.sqrt(
            newVelocity.x * newVelocity.x + 
            newVelocity.z * newVelocity.z
          );
          
          if (newVelocityMagnitude > maxVelocity) {
            const scaleFactor = maxVelocity / newVelocityMagnitude;
            newVelocity.x *= scaleFactor;
            newVelocity.z *= scaleFactor;
          }
          
          // Set the velocity directly instead of applying force
          playerBody.setLinvel(newVelocity, true);
          
          console.log('%cMovement:', 'color: #FF9800; font-weight: bold', {
            targetVelocity,
            newVelocity,
            rotation: newRotation.toFixed(2),
            keys: JSON.stringify(keysRef.current)
          });
        } else {
          // CHANGED: When no movement keys are pressed, rapidly decelerate to a stop
          // Apply a strong braking force - reduce velocity by 85% each frame
          playerBody.setLinvel(
            {
              x: currentVel.x * 0.15,
              y: currentVel.y,
              z: currentVel.z * 0.15
            },
            true
          );
          
          // If nearly stopped, just set to zero to prevent drift
          if (velocityMagnitude < 0.1) {
            playerBody.setLinvel({ x: 0, y: currentVel.y, z: 0 }, true);
          }
        }
        
        // Update camera position and rotation with smoothing - MOVED OUTSIDE CONDITIONAL
        const targetPosition = new THREE.Vector3(
          pos.x - Math.sin(newRotation) * 0.3, // Position slightly behind
          pos.y + 0.5, // Slightly above the capsule
          pos.z - Math.cos(newRotation) * 0.3  // Position slightly behind
        );
        
        // Get current camera position
        const currentPosition = new THREE.Vector3();
        camera.getWorldPosition(currentPosition);
        
        // Apply smooth lerping to camera position with much smaller factor
        const positionLerpFactor = velocityMagnitude < 0.1 
          ? 0.1  // Quick response when stationary
          : Math.max(0.01, 0.05 - (velocityMagnitude * 0.01)); // Smoother at higher speeds
        currentPosition.lerp(targetPosition, positionLerpFactor);
        camera.position.copy(currentPosition);
        
        // Smoothly interpolate camera rotation
        const currentRotation = camera.rotation.y;
        const targetRotation = newRotation;
        const rotationLerpFactor = 0.05; // Reduced for smoother rotation
        camera.rotation.y = currentRotation + (targetRotation - currentRotation) * rotationLerpFactor;
        
        // Update trail visualization
        if (playerBodyRef.current) {
          const playerPos = playerBody.translation();
          const newPoint = new THREE.Vector3(playerPos.x, playerPos.y + 0.1, playerPos.z);
          
          // Only add points if moved enough to be visible
          const lastPoint = trailPointsRef.current.length > 0 ? 
            trailPointsRef.current[trailPointsRef.current.length - 1] : null;
          
          if (!lastPoint || lastPoint.distanceTo(newPoint) > 0.2) {
            trailPointsRef.current.push(newPoint);
            
            // Limit trail length
            if (trailPointsRef.current.length > MAX_TRAIL_POINTS) {
              trailPointsRef.current.shift();
            }
            
            // Update line geometry
            trailGeometry.setFromPoints(trailPointsRef.current);
          }
        }
        
        // Check collisions
        const radius = 0.5;
        const rayDirections = [
          {x: 1, y: 0, z: 0},
          {x: -1, y: 0, z: 0},
          {x: 0, y: 0, z: 1},
          {x: 0, y: 0, z: -1},
        ];
        
        const isColliding = rayDirections.some(dir => {
          const ray = new RAPIER.Ray(physicsState.position, dir);
          return world.castRay(ray, radius * 2, true) !== null;
        });
        
        // Update React state
        setGameState(prev => ({
          ...prev,
          position: new THREE.Vector3(
            physicsState.position.x,
            physicsState.position.y,
            physicsState.position.z
          ),
          rotation: newRotation,
          isColliding
        }));
        
        // Handle collision feedback
        if (isColliding) {
          const walls = scene.children.filter(child => 
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
      
      // Always render at the end with the final state
      renderer.render(scene, camera);
    };

    // Handle window resize
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Start animation loop
    console.log('Starting animation loop...');
    animate(0);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('click', handleCanvasClick);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
    };
  }, []);

  return (
    <div className={styles.container}>
      <canvas 
        ref={canvasRef} 
        className={styles.canvas} 
        tabIndex={0} 
        onFocus={() => console.log('Canvas focused')} 
        onBlur={() => console.log('Canvas lost focus')} 
      />
      {/* Simple HUD */}
      <div className={styles.hud}>
        <div style={{ 
          position: 'absolute',
          top: '20px',
          left: '20px',
          color: gameState.isColliding ? 'red' : 'white',
          padding: '10px',
          backgroundColor: 'rgba(0,0,0,0.5)',
          borderRadius: '5px',
          fontFamily: 'monospace'
        }}>
          {gameState.isColliding ? 'COLLISION!' : 'No collision'}
        </div>
        
        {/* Debug overlay */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          padding: '10px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          fontFamily: 'monospace',
          borderRadius: '5px'
        }}>
          <div>Keys: {JSON.stringify(keysRef.current)}</div>
          <div>Position: X:{gameState.position.x.toFixed(2)} Y:{gameState.position.y.toFixed(2)} Z:{gameState.position.z.toFixed(2)}</div>
          <div>Rotation: {gameState.rotation.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
};
