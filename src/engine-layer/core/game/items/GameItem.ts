import { Vector3, Quaternion, Object3D } from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { GameEventManager, GameEventType } from '../events/GameEventManager';

export enum GameItemType {
  POWERUP = 'powerup',
  OBSTACLE = 'obstacle',
  COLLECTIBLE = 'collectible'
}

export interface GameItemConfig {
  type: GameItemType;
  mass: number;
  size: Vector3;
  position: Vector3;
  rotation: Quaternion;
  model?: string;  // Path to 3D model if needed
  properties?: { [key: string]: any };
}

export class GameItem {
  readonly type: GameItemType;
  private body: RAPIER.RigidBody;
  private mesh: Object3D;
  private config: GameItemConfig;
  private gameEventManager: GameEventManager;

  constructor(body: RAPIER.RigidBody, mesh: Object3D, config: GameItemConfig) {
    this.body = body;
    this.mesh = mesh;
    this.config = config;
    this.type = config.type;
    this.gameEventManager = GameEventManager.getInstance();
  }

  update(): void {
    // Update visual representation based on physics
    const position = this.body.translation();
    const rotation = this.body.rotation();
    
    this.mesh.position.set(position.x, position.y, position.z);
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

    // Emit physics update event
    this.gameEventManager.emit({
      type: GameEventType.PHYSICS_UPDATE,
      timestamp: performance.now(),
      position: this.mesh.position,
      data: { itemType: this.type }
    });
  }

  onCollision(other: GameItem): void {
    // Handle item-specific collision behavior
    switch (this.type) {
      case GameItemType.POWERUP:
        this.handlePowerupCollision(other);
        break;
      case GameItemType.OBSTACLE:
        this.handleObstacleCollision(other);
        break;
      case GameItemType.COLLECTIBLE:
        this.handleCollectibleCollision(other);
        break;
    }
  }

  private handlePowerupCollision(_other: GameItem): void {
    // Implement powerup behavior
    this.gameEventManager.emit({
      type: GameEventType.ITEM_PICKUP,
      timestamp: performance.now(),
      position: this.mesh.position,
      data: { itemType: GameItemType.POWERUP, properties: this.config.properties }
    });
  }

  private handleObstacleCollision(_other: GameItem): void {
    // Implement obstacle behavior
  }

  private handleCollectibleCollision(_other: GameItem): void {
    // Implement collectible behavior
    this.gameEventManager.emit({
      type: GameEventType.ITEM_PICKUP,
      timestamp: performance.now(),
      position: this.mesh.position,
      data: { itemType: GameItemType.COLLECTIBLE, properties: this.config.properties }
    });
  }

  dispose(): void {
    // Cleanup resources
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
  }
}
