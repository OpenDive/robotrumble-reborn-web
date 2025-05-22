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
  
  // Input state
  const [keys, setKeys] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false
  });

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
        .setLinearDamping(5.0) // Add damping to prevent sliding
        .setAngularDamping(1.0);
      
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

    // Store refs for cleanup
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // Handle keyboard input
    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      let newKeys = { ...keys };
      
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
      
      // Only update if keys changed
      if (JSON.stringify(newKeys) !== JSON.stringify(keys)) {
        console.log('%cKeys:', 'color: #2196F3; font-weight: bold', newKeys);
        setKeys(newKeys);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      event.preventDefault();
      let newKeys = { ...keys };
      
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
      
      // Only update if keys changed
      if (JSON.stringify(newKeys) !== JSON.stringify(keys)) {
        console.log('%cKeys:', 'color: #2196F3; font-weight: bold', newKeys);
        setKeys(newKeys);
      }
    };

    const canvas = canvasRef.current;
    canvas.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('keyup', handleKeyUp);

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
        const isMoving = Object.values(keys).some(key => key) || 
                        Math.abs(physicsState.velocity.x) > 0.1 || 
                        Math.abs(physicsState.velocity.z) > 0.1;
        
        if (isMoving) {
          console.log('%cState:', 'color: #4CAF50; font-weight: bold', {
            keys,
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
        if (keys.left) newRotation += rotationSpeed * deltaTime;
        if (keys.right) newRotation -= rotationSpeed * deltaTime;
        
        // Handle movement
        const speed = 50.0; // Increased for better response
        const moveDirection = new THREE.Vector3(0, 0, 0);
        
        if (keys.forward) moveDirection.z = -1; // Forward
        if (keys.backward) moveDirection.z = 1;  // Backward
        
        // Apply movement if any movement keys are pressed
        if (keys.forward || keys.backward) {
          // Apply rotation to movement vector
          moveDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), newRotation);
          moveDirection.multiplyScalar(speed); // Keep consistent force
          
          const impulse = {
            x: moveDirection.x,
            y: 0,
            z: moveDirection.z
          };
          
          console.log('%cMovement:', 'color: #FF9800; font-weight: bold', {
            impulse,
            rotation: newRotation.toFixed(2),
            deltaTime: deltaTime.toFixed(3),
            keys: JSON.stringify(keys)
          });
          
          // Apply force instead of impulse for smoother movement
          playerBody.addForce(impulse, true);
        }
        
        // Update camera position and rotation
        const pos = playerBody.translation();
        camera.position.set(
          pos.x,
          pos.y + 0.5, // Slightly above the capsule
          pos.z
        );
        
        // Smoothly interpolate camera rotation
        const currentRotation = camera.rotation.y;
        const targetRotation = newRotation;
        camera.rotation.y = currentRotation + (targetRotation - currentRotation) * 0.1;
        
        // Apply velocity damping when not moving
        if (!keys.forward && !keys.backward) {
          playerBody.setLinvel(
            {
              x: physicsState.velocity.x * 0.9,
              y: 0,
              z: physicsState.velocity.z * 0.9
            },
            true
          );
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
        
        // Update camera for first-person view
        camera.position.set(
          physicsState.position.x,
          physicsState.position.y + 1,
          physicsState.position.z
        );
        camera.rotation.y = newRotation;
        
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
      canvas.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('keyup', handleKeyUp);
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
      </div>
    </div>
  );
};
