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
      
      // Create wall colliders
      // Left wall
      const leftWallDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 10.0);
      leftWallDesc.translation = {x: -5, y: 0.5, z: 0};
      world.createCollider(leftWallDesc);
      
      // Right wall
      const rightWallDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 10.0);
      rightWallDesc.translation = {x: 5, y: 0.5, z: 0};
      world.createCollider(rightWallDesc);
      
      // Create player rigid body
      const playerBodyDesc = RAPIER.RigidBodyDesc.dynamic();
      playerBodyDesc.translation = {x: 0, y: 1, z: 0};
      const playerBody = world.createRigidBody(playerBodyDesc);
      
      // Add player collider
      const playerColliderDesc = RAPIER.ColliderDesc.ball(0.5);
      world.createCollider(playerColliderDesc, playerBody);
      
      playerBodyRef.current = playerBody;
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
    if (!canvasRef.current) return;

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
    camera.position.set(0, 2, 5); // Position for testing, will be updated based on robot position
    
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
      switch(event.code) {
        case 'ArrowUp':
        case 'KeyW':
          setKeys(prev => ({ ...prev, forward: true }));
          break;
        case 'ArrowDown':
        case 'KeyS':
          setKeys(prev => ({ ...prev, backward: true }));
          break;
        case 'ArrowLeft':
        case 'KeyA':
          setKeys(prev => ({ ...prev, left: true }));
          break;
        case 'ArrowRight':
        case 'KeyD':
          setKeys(prev => ({ ...prev, right: true }));
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch(event.code) {
        case 'ArrowUp':
        case 'KeyW':
          setKeys(prev => ({ ...prev, forward: false }));
          break;
        case 'ArrowDown':
        case 'KeyS':
          setKeys(prev => ({ ...prev, backward: false }));
          break;
        case 'ArrowLeft':
        case 'KeyA':
          setKeys(prev => ({ ...prev, left: false }));
          break;
        case 'ArrowRight':
        case 'KeyD':
          setKeys(prev => ({ ...prev, right: false }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Update physics world
      if (worldRef.current && playerBodyRef.current) {
        const world = worldRef.current;
        const playerBody = playerBodyRef.current;
        
        world.step();
        
        // Update game state based on input
        setGameState(prev => {
          const newState = { ...prev };
          
          // Handle rotation
          if (keys.left) newState.rotation += 0.03;
          if (keys.right) newState.rotation -= 0.03;
          
          // Handle movement
          const speed = 2.0;
          const damping = 0.95; // Slow down naturally
          
          if (keys.forward || keys.backward) {
            const direction = keys.forward ? 1 : -1;
            const impulse = {
              x: Math.sin(newState.rotation) * speed * direction,
              y: 0,
              z: Math.cos(newState.rotation) * speed * direction
            };
            playerBody.applyImpulse(impulse, true);
          }
          
          // Apply damping
          const vel = playerBody.linvel();
          playerBody.setLinvel(
            {
              x: vel.x * damping,
              y: vel.y,
              z: vel.z * damping
            },
            true
          );
          
          // Update position from physics
          const pos = playerBody.translation();
          newState.position.set(pos.x, pos.y, pos.z);
          
          // Check for collisions using raycasts
          const radius = 0.5; // Ball radius
          
          // Cast rays in multiple directions to simulate sphere collision
          const rayDirections = [
            {x: 1, y: 0, z: 0},   // Right
            {x: -1, y: 0, z: 0},  // Left
            {x: 0, y: 0, z: 1},   // Forward
            {x: 0, y: 0, z: -1},  // Back
          ];
          
          newState.isColliding = rayDirections.some(dir => {
            const ray = new RAPIER.Ray(pos, dir);
            const hit = world.castRay(ray, radius * 2, true);
            return hit !== null;
          });
          
          // Visual feedback for collisions
          if (newState.isColliding) {
            // Flash the walls red when colliding
            const walls = scene.children.filter(child => 
              child instanceof THREE.Mesh && 
              child.material instanceof THREE.MeshStandardMaterial &&
              child.position.y === 0.5
            ) as THREE.Mesh[];
            
            walls.forEach(wall => {
              const material = wall.material as THREE.MeshStandardMaterial;
              material.color.setHex(0xff0000);
              material.emissive.setHex(0x330000);
              
              // Reset after 100ms
              setTimeout(() => {
                material.color.setHex(0xff0000);
                material.emissive.setHex(0x000000);
              }, 100);
            });
          }
        
          // Update camera position and rotation
          if (cameraRef.current) {
            const camera = cameraRef.current;
            camera.position.copy(newState.position);
            camera.position.y = 2; // Camera height
            camera.rotation.y = newState.rotation;
          }
          
          return newState;
        });
      }
      
      renderer.render(scene, camera);
    };

    animate();

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

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      renderer.dispose();

    };
  }, []);

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
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
