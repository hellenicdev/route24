import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { BusConfig } from '../data/busConfig';

export interface WheelRig {
  /** Yaw node for steering (front wheels only). */
  steer: TransformNode;
  /** Spin node rotating about the wheel axis. */
  spin: TransformNode;
}

export interface BusRig {
  root: TransformNode;
  wheels: WheelRig[];
  frontWheels: WheelRig[];
}

function createBusSignTexture(
  scene: Scene,
  text: string,
  width = 256,
  height = 96,
): DynamicTexture {
  const texture = new DynamicTexture('bus-sign', { width, height }, scene, false);
  texture.gammaSpace = false;
  const ctx = texture.getContext() as CanvasRenderingContext2D | null;
  if (!ctx) return texture;
  ctx.fillStyle = '#101318';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffb300';
  ctx.font = `900 ${Math.floor(height * 0.6)}px 'Segoe UI', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + height * 0.05);
  texture.update();
  return texture;
}

function markCaster(mesh: Mesh): void {
  mesh.metadata = { castsShadow: true };
  mesh.receiveShadows = true;
}

function createBusMaterial(
  scene: Scene,
  name: string,
  color: Color3,
  roughness: number,
): PBRMaterial {
  const material = new PBRMaterial(name, scene);
  material.albedoColor = color;
  material.metallic = 0;
  material.roughness = roughness;
  return material;
}

function createWheel(
  scene: Scene,
  parent: TransformNode,
  x: number,
  y: number,
  z: number,
  radius: number,
  steerable: boolean,
): WheelRig {
  const steer = new TransformNode('wheel-steer', scene);
  steer.parent = parent;
  steer.position = new Vector3(x, y, z);

  const spin = new TransformNode('wheel-spin', scene);
  spin.parent = steer;

  const tire = MeshBuilder.CreateCylinder(
    'wheel-tire',
    { diameter: radius * 2, height: 0.55, tessellation: 20 },
    scene,
  );
  tire.parent = spin;
  tire.rotation.z = Math.PI / 2;
  tire.material = createBusMaterial(scene, 'tire', new Color3(0.05, 0.05, 0.055), 0.95);

  const hub = MeshBuilder.CreateCylinder(
    'wheel-hub',
    { diameter: radius * 0.62, height: 0.06, tessellation: 16 },
    scene,
  );
  hub.parent = spin;
  hub.position.z = 0.24;
  hub.rotation.z = Math.PI / 2;
  hub.material = createBusMaterial(scene, 'hub', new Color3(0.72, 0.72, 0.78), 0.3);

  if (steerable) markCaster(tire);
  return { steer, spin };
}

/**
 * Procedural low-poly city bus. Every part is parented to a root TransformNode
 * so the vehicle controller can move the whole bus by transforming the root.
 */
export function createBusRig(scene: Scene, config: BusConfig): BusRig {
  const root = new TransformNode('bus-root', scene);
  const { length: L, width: W, height: H } = config;
  const wheelY = config.wheelRadius;

  const body = createBusMaterial(scene, 'bus-body', new Color3(0.93, 0.88, 0.78), 0.45);
  const skirt = createBusMaterial(scene, 'bus-skirt', new Color3(0.72, 0.22, 0.16), 0.6);
  const glass = createBusMaterial(scene, 'bus-glass', new Color3(0.05, 0.06, 0.08), 0.12);
  glass.clearCoat.isEnabled = true;
  glass.clearCoat.intensity = 1;
  const roofMat = createBusMaterial(scene, 'bus-roof', new Color3(0.94, 0.94, 0.92), 0.7);
  const trim = createBusMaterial(scene, 'bus-trim', new Color3(0.1, 0.11, 0.13), 0.7);

  const bodyH = H - 0.55;
  const bodyMesh = MeshBuilder.CreateBox(
    'bus-body-mesh',
    { width: L, height: bodyH, depth: W },
    scene,
  );
  bodyMesh.parent = root;
  bodyMesh.position.y = 0.55 + bodyH / 2;
  bodyMesh.material = body;
  markCaster(bodyMesh);

  const skirtMesh = MeshBuilder.CreateBox(
    'bus-skirt-mesh',
    { width: L, height: 0.4, depth: W + 0.02 },
    scene,
  );
  skirtMesh.parent = root;
  skirtMesh.position.y = 0.78;
  skirtMesh.material = skirt;
  markCaster(skirtMesh);

  const roofMesh = MeshBuilder.CreateBox(
    'bus-roof-mesh',
    { width: L - 0.3, height: 0.16, depth: W - 0.2 },
    scene,
  );
  roofMesh.parent = root;
  roofMesh.position.y = H - 0.04;
  roofMesh.material = roofMat;
  markCaster(roofMesh);

  // Windshield and rear window.
  const windshield = MeshBuilder.CreatePlane('windshield', { width: 2.2, height: 1.0 }, scene);
  windshield.parent = root;
  windshield.position.set(0, 2.35, W / 2 + 0.01);
  windshield.material = glass;

  const rearWindow = MeshBuilder.CreatePlane('rear-window', { width: 2.0, height: 0.9 }, scene);
  rearWindow.parent = root;
  rearWindow.position.set(0, 2.3, -W / 2 - 0.01);
  rearWindow.rotation.y = Math.PI;
  rearWindow.material = glass;

  // Side windows, split by the door positions on the right side.
  for (const side of [-1, 1]) {
    const windows: [number, number][] =
      side === 1
        ? [
            [0.9, 1.5],
            [-1.6, 1.5],
            [-4.2, 1.5],
          ]
        : [
            [0.9, 2.2],
            [-2.4, 2.2],
          ];
    for (const [z, height] of windows) {
      const pane = MeshBuilder.CreatePlane('side-window', { width: 2.6, height }, scene);
      pane.parent = root;
      pane.position.set(side * (W / 2 + 0.01), 2.25, z);
      pane.rotation.y = side === 1 ? Math.PI / 2 : -Math.PI / 2;
      pane.material = glass;
    }
  }

  // Doors on the right (+X) side.
  for (const z of [2.0, -3.2]) {
    const door = MeshBuilder.CreateBox('door', { width: 0.06, height: 2.0, depth: 1.2 }, scene);
    door.parent = root;
    door.position.set(W / 2, 1.7, z);
    door.material = trim;
    markCaster(door);
  }

  // Destination sign.
  const signMat = new PBRMaterial('bus-sign-mat', scene);
  signMat.albedoColor = new Color3(0.06, 0.07, 0.09);
  signMat.emissiveTexture = createBusSignTexture(scene, '24');
  signMat.emissiveColor = Color3.White();
  signMat.roughness = 0.5;
  const sign = MeshBuilder.CreatePlane('dest-sign', { width: 1.7, height: 0.55 }, scene);
  sign.parent = root;
  sign.position.set(0, 2.85, W / 2 + 0.02);
  sign.material = signMat;

  // Lights.
  const headLight = new StandardMaterial('headlight', scene);
  headLight.emissiveColor = new Color3(1, 0.96, 0.85);
  headLight.disableLighting = true;
  const tailLight = new StandardMaterial('taillight', scene);
  tailLight.emissiveColor = new Color3(1, 0.18, 0.12);
  tailLight.disableLighting = true;
  for (const side of [-1, 1]) {
    const head = MeshBuilder.CreateBox(
      'headlight',
      { width: 0.7, height: 0.18, depth: 0.1 },
      scene,
    );
    head.parent = root;
    head.position.set(side * (W / 2 - 0.35), 1.05, W / 2 + 0.02);
    head.material = headLight;

    const tail = MeshBuilder.CreateBox(
      'taillight',
      { width: 0.7, height: 0.14, depth: 0.1 },
      scene,
    );
    tail.parent = root;
    tail.position.set(side * (W / 2 - 0.35), 1.05, -W / 2 - 0.02);
    tail.material = tailLight;
  }

  // Mirrors.
  for (const side of [-1, 1]) {
    const stalk = MeshBuilder.CreateBox(
      'mirror-stalk',
      { width: 0.06, height: 0.5, depth: 0.06 },
      scene,
    );
    stalk.parent = root;
    stalk.position.set(side * (W / 2 + 0.15), 2.75, W / 2 - 0.3);
    stalk.material = trim;
    const mirror = MeshBuilder.CreateBox('mirror', { width: 0.4, height: 0.3, depth: 0.06 }, scene);
    mirror.parent = root;
    mirror.position.set(side * (W / 2 + 0.35), 2.9, W / 2 - 0.3);
    mirror.material = glass;
  }

  // Wheels: two front (steerable), four rear (dual wheels per side).
  const wheels: WheelRig[] = [];
  const frontWheels: WheelRig[] = [];
  const frontZ = config.wheelbase / 2;
  const rearZ = -config.wheelbase / 2;
  const halfTrack = config.trackWidth / 2;

  for (const side of [-1, 1]) {
    const front = createWheel(
      scene,
      root,
      side * halfTrack,
      wheelY,
      frontZ,
      config.wheelRadius,
      true,
    );
    wheels.push(front);
    frontWheels.push(front);

    wheels.push(
      createWheel(scene, root, side * halfTrack, wheelY, rearZ, config.wheelRadius, false),
    );
    wheels.push(
      createWheel(scene, root, side * (halfTrack - 0.72), wheelY, rearZ, config.wheelRadius, false),
    );
  }

  return { root, wheels, frontWheels };
}
