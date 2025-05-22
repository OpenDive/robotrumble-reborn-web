import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import styles from './TestGameScreen.module.css';

interface TestGameScreenProps {
  onBack: () => void;
}

export const TestGameScreen: React.FC<TestGameScreenProps> = ({ onBack }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    animationFrameId?: number;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    cleanup: () => void;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75, // FOV
      window.innerWidth / window.innerHeight, // Aspect ratio
      0.1, // Near plane
      1000 // Far plane
    );

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);

    // Add a simple cube for testing
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Position camera
    camera.position.z = 5;

    // Animation loop
    const animate = () => {
      if (!sceneRef.current) return;
      sceneRef.current.animationFrameId = requestAnimationFrame(animate);
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Store references for cleanup
    sceneRef.current = {
      scene,
      camera,
      renderer,
      cleanup: () => {
        window.removeEventListener('resize', handleResize);
        if (sceneRef.current?.animationFrameId) {
          cancelAnimationFrame(sceneRef.current.animationFrameId);
        }
        renderer.dispose();
        geometry.dispose();
        material.dispose();
      }
    };

    return () => {
      if (sceneRef.current) {
        sceneRef.current.cleanup();
      }
    };
  }, []);

  return (
    <div className={styles.container}>
      <div ref={containerRef} className={styles.gameContainer} />
      <button className={styles.backButton} onClick={onBack}>
        Back
      </button>
    </div>
  );
};
