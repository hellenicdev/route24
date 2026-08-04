import type { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { BusConfig } from '../data/busConfig';
import { createBusRig, type BusRig } from '../render/busFactory';
import {
  createVehicleState,
  stepVehicle,
  type VehicleInput,
  type VehicleState,
} from '../core/vehicleModel';

/**
 * Drivable bus: owns the vehicle model state and writes it to the rendered
 * rig (root pose, wheel spin, steering angle) every fixed simulation step.
 */
export class DrivableBus {
  readonly root: TransformNode;
  readonly config: BusConfig;
  private readonly rig: BusRig;
  private readonly state: VehicleState;
  private lastSteer = 0;
  private wheelAngle = 0;

  constructor(scene: Scene, config: BusConfig, positionX = 0, positionZ = 0, heading = 0) {
    this.config = config;
    this.rig = createBusRig(scene, config);
    this.root = this.rig.root;
    this.state = createVehicleState(positionX, positionZ, heading);
    this.syncPose();
  }

  get speedKph(): number {
    return Math.abs(this.state.speed) * 3.6;
  }

  get gearLabel(): string {
    return this.state.gearIndex === -1 ? 'R' : String(this.state.gearIndex);
  }

  get rpm(): number {
    return this.state.engineRpm;
  }

  get position(): Vector3 {
    return this.root.position;
  }

  get heading(): number {
    return this.state.heading;
  }

  simulate(dt: number, input: VehicleInput): void {
    this.lastSteer = input.steer;
    stepVehicle(this.state, input, dt, this.config);
    this.syncPose(dt);
  }

  private syncPose(dt = 0): void {
    this.root.position.set(this.state.positionX, 0, this.state.positionZ);
    this.root.rotation.y = this.state.heading;
    this.wheelAngle += (this.state.speed / this.config.wheelRadius) * dt;
    for (const wheel of this.rig.wheels) wheel.spin.rotation.x = this.wheelAngle;
    const steerAngle = this.lastSteer * this.config.maxSteerRad;
    for (const wheel of this.rig.frontWheels) wheel.steer.rotation.y = steerAngle;
  }
}
