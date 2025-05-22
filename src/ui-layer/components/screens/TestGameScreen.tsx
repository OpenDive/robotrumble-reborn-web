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
      event.preventDefault(); // Prevent browser scrolling
      
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
    let lastTime = 0;
    const animate = (time: number) => {
      requestAnimationFrame(animate);
      const deltaTime = (time - lastTime) / 1000; // Convert to seconds
      lastTime = time;
      
      // Update physics world
      if (worldRef.current && playerBodyRef.current) {
        const world = worldRef.current;
        const playerBody = playerBodyRef.current;
        
        // Handle rotation first
        let newRotation = gameState.rotation;
        if (keys.left) newRotation += 2 * deltaTime;
        if (keys.right) newRotation -= 2 * deltaTime;
        
        // Handle movement
        const speed = 10.0; // Increased speed for better responsiveness
        const moveDirection = new THREE.Vector3(0, 0, 0);
        
        if (keys.forward) moveDirection.z = -1; // Forward
        if (keys.backward) moveDirection.z = 1;  // Backward
        
        if (moveDirection.length() > 0) {
          // Apply rotation to movement vector
          moveDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), newRotation);
          moveDirection.multiplyScalar(speed);
          
          const impulse = {
            x: moveDirection.x,
            y: 0,
            z: moveDirection.z
          };
          playerBody.applyImpulse(impulse, true);
        }
        
        // Step the physics world
        world.step();
        
        // Cache physics state
        const pos = playerBody.translation();
        const vel = playerBody.linvel();
        
        // Apply damping
        playerBody.setLinvel(
          {
            x: vel.x * 0.8,
            y: 0,
            z: vel.z * 0.8
          },
          true
        );
        
        // Check collisions
        const radius = 0.5;
        const rayDirections = [
          {x: 1, y: 0, z: 0},
          {x: -1, y: 0, z: 0},
          {x: 0, y: 0, z: 1},
          {x: 0, y: 0, z: -1},
        ];
        
        const isColliding = rayDirections.some(dir => {
          const ray = new RAPIER.Ray(pos, dir);
          return world.castRay(ray, radius * 2, true) !== null;
        });
        
        // Update camera for first-person view
        camera.position.set(pos.x, pos.y + 1, pos.z); // Eye level
        camera.rotation.y = newRotation;
        
        // Update React state less frequently
        setGameState(prev => ({
          ...prev,
          position: new THREE.Vector3(pos.x, pos.y, pos.z),
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
      
      renderer.render(scene, camera);
    };

    animate(0);

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
