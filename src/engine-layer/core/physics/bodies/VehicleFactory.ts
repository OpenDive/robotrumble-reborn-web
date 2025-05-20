import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { physicsManager } from '../PhysicsManager';
import { Vehicle, VehicleConfig } from './Vehicle';

export class VehicleFactory {
  private static instance: VehicleFactory;

  private constructor() {}

  static getInstance(): VehicleFactory {
    if (!VehicleFactory.instance) {
      VehicleFactory.instance = new VehicleFactory();
    }
    return VehicleFactory.instance;
  }

  createVehicle(
    position: THREE.Vector3,
    rotation: THREE.Quaternion,
    config: VehicleConfig
  ): Vehicle {
    // Create physics body
    const body = physicsManager.createRigidBody(
      position,
      rotation,
      RAPIER.RigidBodyType.Dynamic,
      {
        linearDamping: 0.5,
        angularDamping: 0.5
      }
    );

    // Set mass properties
    body.setAdditionalMass(config.mass, true);

    // Create collider
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      config.width / 2,
      config.height / 2,
      config.length / 2
    );
    physicsManager.createCollider(body, colliderDesc, {
      restitution: 0.2,
      friction: 0.7
    });

    // Create visual mesh
    const geometry = new THREE.BoxGeometry(config.width, config.height, config.length);
    const material = new THREE.MeshStandardMaterial({
      color: 0x2194ce,
      metalness: 0.7,
      roughness: 0.3
    });
    const mesh = new THREE.Mesh(geometry, material);

    // Create vehicle
    const vehicle = new Vehicle(body, mesh, config);
    physicsManager.registerObject(vehicle);

    return vehicle;
  }
}

export const vehicleFactory = VehicleFactory.getInstance();
