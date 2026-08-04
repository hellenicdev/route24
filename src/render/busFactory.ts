import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { ExtrudeShape } from '@babylonjs/core/Meshes/Builders/shapeBuilder.pure';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Material } from '@babylonjs/core/Materials/material';
import { Mesh as MeshValue } from '@babylonjs/core/Meshes/mesh';
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

/** Counter-clockwise arc in the XY plane, from a0 to a1 (a1 > a0). */
function arcPoints(
  cx: number,
  cy: number,
  radius: number,
  a0: number,
  a1: number,
  segments: number,
): Vector3[] {
  const points: Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = a0 + ((a1 - a0) * i) / segments;
    points.push(new Vector3(cx + radius * Math.cos(a), cy + radius * Math.sin(a), 0));
  }
  return points;
}

/** Counter-clockwise rounded rectangle centred on the origin. */
function roundedRectPoints(
  width: number,
  height: number,
  radius: number,
  arcSegments: number,
): Vector3[] {
  const hw = width / 2;
  const hh = height / 2;
  const points: Vector3[] = [new Vector3(-hw, -hh, 0)];
  points.push(new Vector3(-hw + radius, -hh, 0));
  points.push(
    ...arcPoints(-hw + radius, -hh + radius, radius, Math.PI, Math.PI * 1.5, arcSegments).reverse(),
  );
  points.push(new Vector3(-hw, hh - radius, 0));
  points.push(
    ...arcPoints(-hw + radius, hh - radius, radius, Math.PI * 0.5, Math.PI, arcSegments).reverse(),
  );
  points.push(new Vector3(hw - radius, hh, 0));
  points.push(
    ...arcPoints(hw - radius, hh - radius, radius, 0, Math.PI * 0.5, arcSegments).reverse(),
  );
  points.push(new Vector3(hw, -hh + radius, 0));
  points.push(
    ...arcPoints(
      hw - radius,
      -hh + radius,
      radius,
      Math.PI * 1.5,
      Math.PI * 2,
      arcSegments,
    ).reverse(),
  );
  points.push(new Vector3(-hw + radius, -hh, 0));
  return points;
}

/**
 * Bus body cross-section: straight walls, filleted corners and a domed roof
 * ("loaf" profile, like a modern city bus). Counter-clockwise.
 */
function loafProfile(
  halfWidth: number,
  wallHeight: number,
  cornerRadius: number,
  domeRadius: number,
  cornerSegments: number,
  domeSegments: number,
): Vector3[] {
  const points: Vector3[] = [new Vector3(-halfWidth, 0.32, 0)];
  points.push(new Vector3(halfWidth, 0.32, 0));
  points.push(new Vector3(halfWidth, wallHeight, 0));
  points.push(
    ...arcPoints(
      halfWidth - cornerRadius,
      wallHeight,
      cornerRadius,
      0,
      Math.PI * 0.5,
      cornerSegments,
    ),
  );
  points.push(new Vector3(domeRadius, wallHeight + cornerRadius, 0));
  points.push(...arcPoints(0, wallHeight + cornerRadius, domeRadius, 0, Math.PI, domeSegments));
  points.push(new Vector3(-halfWidth + cornerRadius, wallHeight + cornerRadius, 0));
  points.push(
    ...arcPoints(
      -halfWidth + cornerRadius,
      wallHeight,
      cornerRadius,
      Math.PI * 0.5,
      Math.PI,
      cornerSegments,
    ),
  );
  points.push(new Vector3(-halfWidth, wallHeight, 0));
  return points;
}

/** Extrudes a 2D shape along Z. */
function extrudeZ(
  scene: Scene,
  name: string,
  shape: Vector3[],
  z0: number,
  z1: number,
  material: Material,
  capped: boolean,
): Mesh {
  const mesh = ExtrudeShape(
    name,
    {
      shape,
      path: [new Vector3(0, 0, z0), new Vector3(0, 0, z1)],
      cap: capped ? MeshValue.CAP_ALL : 0,
      sideOrientation: MeshValue.DOUBLESIDE,
    },
    scene,
  );
  mesh.material = material;
  return mesh;
}

/**
 * Rounded panel of `width` × `height` with `thickness`, facing +X (rotated
 * 90° about Y). The panel extends from its origin in the +X direction.
 */
function roundedPanel(
  scene: Scene,
  name: string,
  width: number,
  height: number,
  radius: number,
  thickness: number,
  material: Material,
): Mesh {
  const mesh = extrudeZ(
    scene,
    name,
    roundedRectPoints(width, height, radius, 3),
    0,
    thickness,
    material,
    false,
  );
  mesh.rotation.y = Math.PI / 2;
  return mesh;
}

/** Rounded panel facing -X (mirror of roundedPanel). */
function roundedPanelBack(
  scene: Scene,
  name: string,
  width: number,
  height: number,
  radius: number,
  thickness: number,
  material: Material,
): Mesh {
  const mesh = roundedPanel(scene, name, width, height, radius, thickness, material);
  mesh.rotation.y = -Math.PI / 2;
  return mesh;
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
    { diameter: radius * 2, height: 0.55, tessellation: 24 },
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
 * Procedural city bus with a rounded, domed-roof body. The bus faces +Z; the
 * body is an extruded "loaf" cross-section, the windshield and rear window are
 * curved wrap-around glass, and the wheel arches are raised lips. Every part
 * is parented to a root TransformNode so the vehicle controller can move the
 * whole bus by transforming the root.
 */
export function createBusRig(scene: Scene, config: BusConfig): BusRig {
  const root = new TransformNode('bus-root', scene);
  const { length: L, width: W } = config;
  const halfW = W / 2;
  const wheelY = config.wheelRadius;
  const axleZ = config.wheelbase / 2;
  const bodyTop = 2.15 + 0.5 + 0.43;

  const body = createBusMaterial(scene, 'bus-body', new Color3(0.93, 0.88, 0.78), 0.45);
  body.anisotropy.isEnabled = true;
  body.anisotropy.intensity = 0.35;
  const skirt = createBusMaterial(scene, 'bus-skirt', new Color3(0.72, 0.22, 0.16), 0.6);
  const glass = createBusMaterial(scene, 'bus-glass', new Color3(0.05, 0.06, 0.08), 0.12);
  glass.clearCoat.isEnabled = true;
  glass.clearCoat.intensity = 1;
  const roofMat = createBusMaterial(scene, 'bus-roof', new Color3(0.94, 0.94, 0.92), 0.7);
  const trim = createBusMaterial(scene, 'bus-trim', new Color3(0.1, 0.11, 0.13), 0.7);
  const headLight = new StandardMaterial('headlight', scene);
  headLight.emissiveColor = new Color3(1, 0.96, 0.85);
  headLight.disableLighting = true;
  const tailLight = new StandardMaterial('taillight', scene);
  tailLight.emissiveColor = new Color3(1, 0.18, 0.12);
  tailLight.disableLighting = true;

  const bodyMesh = extrudeZ(
    scene,
    'bus-body-mesh',
    loafProfile(halfW, 2.15, 0.5, 0.43, 4, 8),
    -L / 2,
    L / 2,
    body,
    true,
  );
  bodyMesh.parent = root;
  markCaster(bodyMesh);

  // Curved wrap-around windshield and rear window (cylinder bands centred on
  // +Z / -Z, proud of the body caps).
  const glassArc = {
    diameter: 5.2,
    height: 1.5,
    tessellation: 40,
    arc: Math.PI / 3,
    sideOrientation: MeshValue.FRONTSIDE,
  };
  const windshield = MeshBuilder.CreateCylinder('windshield', { ...glassArc }, scene);
  windshield.parent = root;
  windshield.rotation.y = (-2 * Math.PI) / 3;
  windshield.position.set(0, 1.7, 3.7);
  windshield.material = glass;

  const rearWindow = MeshBuilder.CreateCylinder('rear-window', { ...glassArc }, scene);
  rearWindow.parent = root;
  rearWindow.rotation.y = Math.PI / 3;
  rearWindow.position.set(0, 1.7, -3.7);
  rearWindow.material = glass;

  // Glass rims (trim strips).
  const frameTop = extrudeZ(
    scene,
    'ws-frame-top',
    roundedRectPoints(2.6, 0.09, 0.04, 2),
    6.3,
    6.4,
    trim,
    false,
  );
  frameTop.parent = root;
  frameTop.position.set(0, 2.5, 0);
  const frameBottom = extrudeZ(
    scene,
    'ws-frame-bottom',
    roundedRectPoints(2.6, 0.09, 0.04, 2),
    6.3,
    6.4,
    trim,
    false,
  );
  frameBottom.parent = root;
  frameBottom.position.set(0, 0.93, 0);
  for (const side of [-1, 1]) {
    const frameSide = extrudeZ(
      scene,
      'ws-frame-side',
      roundedRectPoints(0.06, 1.56, 0.02, 2),
      5.95,
      6.15,
      trim,
      false,
    );
    frameSide.parent = root;
    frameSide.position.set(side * 1.32, 1.7, 0);
  }
  const rearFrameTop = extrudeZ(
    scene,
    'rw-frame-top',
    roundedRectPoints(2.6, 0.09, 0.04, 2),
    -6.4,
    -6.3,
    trim,
    false,
  );
  rearFrameTop.parent = root;
  rearFrameTop.position.set(0, 2.5, 0);
  const rearFrameBottom = extrudeZ(
    scene,
    'rw-frame-bottom',
    roundedRectPoints(2.6, 0.09, 0.04, 2),
    -6.4,
    -6.3,
    trim,
    false,
  );
  rearFrameBottom.parent = root;
  rearFrameBottom.position.set(0, 0.93, 0);
  for (const side of [-1, 1]) {
    const frameSide = extrudeZ(
      scene,
      'rw-frame-side',
      roundedRectPoints(0.06, 1.56, 0.02, 2),
      -6.15,
      -5.95,
      trim,
      false,
    );
    frameSide.parent = root;
    frameSide.position.set(side * 1.32, 1.7, 0);
  }

  // Side windows: rounded panels hugging the body sides.
  const windowSpans: [number, number][] = [
    [4.35, 1.5],
    [1.2, 1.5],
    [-1.55, 1.5],
    [-4.6, 1.5],
  ];
  for (const [zCenter, width] of windowSpans) {
    const right = roundedPanel(scene, 'side-window', width, 1.1, 0.22, 0.03, glass);
    right.parent = root;
    right.position.set(halfW + 0.02, 1.55, zCenter + width / 2);
    const left = roundedPanelBack(scene, 'side-window', width + 0.1, 1.1, 0.22, 0.03, glass);
    left.parent = root;
    left.position.set(-(halfW + 0.02), 1.55, zCenter - (width + 0.1) / 2);
  }

  // Doors on the right (+X) side: rounded panels with a window.
  for (const zCenter of [2.55, -3.2]) {
    const door = roundedPanel(scene, 'door', 0.95, 1.95, 0.08, 0.05, trim);
    door.parent = root;
    door.position.set(halfW + 0.02, 1.7, zCenter + 0.475);
    markCaster(door);
    const window = roundedPanel(scene, 'door-window', 0.68, 1.0, 0.07, 0.04, glass);
    window.parent = root;
    window.position.set(halfW + 0.05, 1.85, zCenter + 0.34);
  }

  // Red skirt band along the lower body.
  for (const side of [-1, 1]) {
    for (const [z0, z1] of [
      [3.9, 5.8],
      [-2.2, 2.2],
      [-5.8, -3.9],
    ] as const) {
      const segment = extrudeZ(
        scene,
        'skirt',
        roundedRectPoints(0.06, 0.32, 0.03, 2),
        z0,
        z1,
        skirt,
        false,
      );
      segment.parent = root;
      segment.position.set(side * (halfW + 0.02), 0.5, 0);
    }
  }
  for (const sign of [-1, 1]) {
    const panel = extrudeZ(
      scene,
      'skirt-end',
      roundedRectPoints(2.45, 0.36, 0.1, 2),
      sign * 5.92,
      sign * 5.99,
      skirt,
      false,
    );
    panel.parent = root;
    panel.position.set(0, 0.5, 0);
  }

  // Bumpers.
  for (const sign of [-1, 1]) {
    const bumper = extrudeZ(
      scene,
      'bumper',
      roundedRectPoints(2.5, 0.34, 0.15, 3),
      sign * 5.98,
      sign * 6.06,
      trim,
      false,
    );
    bumper.parent = root;
    bumper.position.set(0, 0.46, 0);
  }

  // Wheel arches (raised lips) and dark wheel wells.
  for (const side of [-1, 1]) {
    for (const zSign of [-1, 1]) {
      const arch = MeshBuilder.CreateTorus(
        'wheel-arch',
        {
          diameter: 1.26,
          thickness: 0.09,
          tessellation: 14,
          arc: Math.PI,
        } as unknown as Parameters<typeof MeshBuilder.CreateTorus>[1],
        scene,
      );
      arch.parent = root;
      arch.rotation.y = Math.PI / 2;
      arch.position.set(side * (halfW - 0.02), wheelY, zSign * axleZ);
      arch.material = body;
      markCaster(arch);

      const well = MeshBuilder.CreateBox(
        'wheel-well',
        { width: 0.26, height: 1.1, depth: 0.62 },
        scene,
      );
      well.parent = root;
      well.position.set(side * (halfW - 0.14), wheelY, zSign * axleZ);
      well.material = trim;
    }
  }

  // Roof pods hugging the shoulders of the dome, plus dome lights.
  const roofY = 2.15 + 0.5;
  for (const side of [-1, 1]) {
    const rearPod = extrudeZ(
      scene,
      'roof-pod',
      roundedRectPoints(0.62, 0.22, 0.1, 2),
      -3.95,
      -2.55,
      roofMat,
      true,
    );
    rearPod.parent = root;
    rearPod.position.set(side * 0.75, roofY + 0.1, 0);
    markCaster(rearPod);
    const frontPod = extrudeZ(
      scene,
      'roof-pod',
      roundedRectPoints(0.5, 0.18, 0.08, 2),
      2.0,
      3.2,
      roofMat,
      true,
    );
    frontPod.parent = root;
    frontPod.position.set(side * 0.72, roofY + 0.1, 0);
    markCaster(frontPod);
  }
  for (const side of [-1, 1]) {
    for (const z of [-3.65, -2.85]) {
      const vent = MeshBuilder.CreateCylinder(
        'pod-vent',
        { diameter: 0.36, height: 0.05, tessellation: 12 },
        scene,
      );
      vent.parent = root;
      vent.position.set(side * 0.75, 2.87, z);
      vent.material = trim;
    }
  }
  for (const z of [1.0, -1.0]) {
    const marker = MeshBuilder.CreateCylinder(
      'roof-marker',
      { diameter: 0.2, height: 0.05, tessellation: 12 },
      scene,
    );
    marker.parent = root;
    marker.position.set(0, bodyTop + 0.02, z);
    marker.material = headLight;
  }

  // Destination sign housing + emissive sign.
  const signHousing = extrudeZ(
    scene,
    'sign-housing',
    roundedRectPoints(2.15, 0.62, 0.14, 3),
    -0.05,
    0.05,
    trim,
    true,
  );
  signHousing.parent = root;
  signHousing.position.set(0, 2.62, L / 2 - 0.07);
  markCaster(signHousing);
  const signMat = new PBRMaterial('bus-sign-mat', scene);
  signMat.albedoColor = new Color3(0.06, 0.07, 0.09);
  signMat.emissiveTexture = createBusSignTexture(scene, '24');
  signMat.emissiveColor = Color3.White();
  signMat.roughness = 0.5;
  const sign = MeshBuilder.CreatePlane('dest-sign', { width: 1.7, height: 0.5 }, scene);
  sign.parent = root;
  sign.position.set(0, 2.62, L / 2);
  sign.material = signMat;

  // Lights.
  for (const side of [-1, 1]) {
    const head = extrudeZ(
      scene,
      'headlight',
      roundedRectPoints(0.68, 0.17, 0.06, 2),
      -0.05,
      0.05,
      headLight,
      false,
    );
    head.parent = root;
    head.position.set(side * (halfW - 0.48), 0.82, L / 2 - 0.05);
    const tail = extrudeZ(
      scene,
      'taillight',
      roundedRectPoints(0.68, 0.17, 0.06, 2),
      -0.05,
      0.05,
      tailLight,
      false,
    );
    tail.parent = root;
    tail.position.set(side * (halfW - 0.48), 0.85, -L / 2 + 0.05);
  }

  // Mirrors.
  for (const side of [-1, 1]) {
    const stalk = extrudeZ(
      scene,
      'mirror-stalk',
      roundedRectPoints(0.07, 0.45, 0.03, 2),
      -0.04,
      0.04,
      trim,
      false,
    );
    stalk.parent = root;
    stalk.position.set(side * (halfW + 0.12), 2.6, L / 2 - 0.6);
    const head =
      side === 1
        ? roundedPanel(scene, 'mirror', 0.44, 0.32, 0.09, 0.07, glass)
        : roundedPanelBack(scene, 'mirror', 0.44, 0.32, 0.09, 0.07, glass);
    head.parent = root;
    head.position.set(side * (halfW + 0.3), 2.85, side === 1 ? L / 2 - 0.38 : L / 2 - 0.82);
  }

  // Wheels: two front (steerable), four rear (dual wheels per side).
  const wheels: WheelRig[] = [];
  const frontWheels: WheelRig[] = [];
  const halfTrack = config.trackWidth / 2;

  for (const side of [-1, 1]) {
    const front = createWheel(
      scene,
      root,
      side * halfTrack,
      wheelY,
      axleZ,
      config.wheelRadius,
      true,
    );
    wheels.push(front);
    frontWheels.push(front);

    wheels.push(
      createWheel(scene, root, side * halfTrack, wheelY, -axleZ, config.wheelRadius, false),
    );
    wheels.push(
      createWheel(
        scene,
        root,
        side * (halfTrack - 0.72),
        wheelY,
        -axleZ,
        config.wheelRadius,
        false,
      ),
    );
  }

  return { root, wheels, frontWheels };
}
