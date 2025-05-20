import { Vector3 } from 'three';
import { GameEventManager, GameEventType } from '../events/GameEventManager';
import { EffectManager } from '../../effects/EffectManager';

export interface CollisionData {
  position: Vector3;
  normal: Vector3;
  impulse: number;
  bodyA: any;  // Replace with proper type
  bodyB: any;  // Replace with proper type
}

export class CollisionManager {
  private static instance: CollisionManager;
  private gameEventManager: GameEventManager;
  private effectManager: EffectManager;

  private constructor() {
    this.gameEventManager = GameEventManager.getInstance();
    this.effectManager = EffectManager.getInstance();
  }

  static getInstance(): CollisionManager {
    if (!CollisionManager.instance) {
      CollisionManager.instance = new CollisionManager();
    }
    return CollisionManager.instance;
  }

  handleCollision(data: CollisionData): void {
    // Emit game event
    this.gameEventManager.emit({
      type: GameEventType.COLLISION,
      timestamp: performance.now(),
      position: data.position,
      data: data
    });

    // Trigger appropriate effects based on collision type
    this.triggerCollisionEffects(data);
  }

  private triggerCollisionEffects(data: CollisionData): void {
    // Trigger effects based on collision intensity
    if (data.impulse > 10) {
      this.effectManager.emitExplosion(data.position);
    } else if (data.impulse > 5) {
      this.effectManager.emitSmoke(data.position);
    }
  }

  dispose(): void {
    // Cleanup any resources if needed
  }
}
