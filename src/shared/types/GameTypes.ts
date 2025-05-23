import * as THREE from 'three';

export interface GameState {
  position: THREE.Vector3;
  rotation: number;
  velocity: THREE.Vector2;
  isColliding: boolean;
}

export interface KeyState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
} 