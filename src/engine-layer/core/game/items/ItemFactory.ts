import { BoxGeometry, MeshStandardMaterial, Mesh, Object3D } from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { GameItem, GameItemConfig, GameItemType } from './GameItem';
import { PhysicsManager } from '../../physics/PhysicsManager';

export class ItemFactory {
  private static instance: ItemFactory;
  private physicsManager: PhysicsManager;

  private constructor() {
    this.physicsManager = PhysicsManager.getInstance();
  }

  static getInstance(): ItemFactory {
    if (!ItemFactory.instance) {
      ItemFactory.instance = new ItemFactory();
    }
    return ItemFactory.instance;
  }

  createItem(config: GameItemConfig): GameItem {
    // Create physics body
    const body = this.physicsManager.createRigidBody(
      config.position,
      config.rotation,
      this.getRigidBodyType(config.type),
      {
        linearDamping: 0.5,
        angularDamping: 0.5
      }
    );

    // Create visual mesh
    const mesh = this.createMesh(config);

    // Create and return game item
    return new GameItem(body, mesh, config);
  }

  private getRigidBodyType(itemType: GameItemType): RAPIER.RigidBodyType {
    switch (itemType) {
      case GameItemType.OBSTACLE:
        return RAPIER.RigidBodyType.Fixed;
      case GameItemType.POWERUP:
      case GameItemType.COLLECTIBLE:
        return RAPIER.RigidBodyType.Dynamic;
      default:
        return RAPIER.RigidBodyType.Dynamic;
    }
  }

  private createMesh(config: GameItemConfig): Object3D {
    // If a model path is provided, load it (implementation needed)
    if (config.model) {
      // return this.loadModel(config.model);
      // TODO: Implement model loading
    }

    // Otherwise create a basic geometry
    const geometry = new BoxGeometry(
      config.size.x,
      config.size.y,
      config.size.z
    );

    const material = new MeshStandardMaterial({
      color: this.getItemColor(config.type),
      metalness: 0.5,
      roughness: 0.5
    });

    return new Mesh(geometry, material);
  }

  private getItemColor(type: GameItemType): number {
    switch (type) {
      case GameItemType.POWERUP:
        return 0xffff00;  // Yellow
      case GameItemType.OBSTACLE:
        return 0xff0000;  // Red
      case GameItemType.COLLECTIBLE:
        return 0x00ff00;  // Green
      default:
        return 0xcccccc;  // Gray
    }
  }
}
