import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';

const BUILDING_RING_MIN = 182;
const BUILDING_RING_MAX = 212;
const TREE_RING_MIN = 164;
const TREE_RING_MAX = 178;

function markCaster(mesh: Mesh): void {
  mesh.metadata = { castsShadow: true };
  mesh.receiveShadows = true;
}

/** Pseudo-random facade: dark glass grid with scattered lit windows. */
function createFacadeTexture(scene: Scene, seed: number): DynamicTexture {
  const texture = new DynamicTexture(`facade-${seed}`, { width: 256, height: 512 }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D | null;
  if (!ctx) return texture;
  let state = seed >>> 0;
  const rand = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };

  ctx.fillStyle = '#242830';
  ctx.fillRect(0, 0, 256, 512);
  const cols = 4;
  const rows = 10;
  const cellW = 256 / cols;
  const cellH = 512 / rows;
  const windowW = cellW * 0.62;
  const windowH = cellH * 0.66;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + (cellW - windowW) / 2;
      const y = r * cellH + (cellH - windowH) / 2;
      const roll = rand();
      if (roll < 0.22) {
        const palette = ['#ffd98a', '#cfe4ff', '#ffbe6e', '#e8f2d0'];
        ctx.fillStyle = palette[Math.floor(rand() * 4)] ?? '#ffd98a';
      } else if (roll < 0.28) {
        ctx.fillStyle = '#4a5260';
      } else {
        ctx.fillStyle = '#10141c';
      }
      ctx.fillRect(x, y, windowW, windowH);
      if (roll >= 0.28 && rand() < 0.55) {
        ctx.fillStyle = 'rgba(60, 70, 88, 0.9)';
        ctx.fillRect(x, y + windowH * 0.55, windowW, windowH * 0.4);
      }
    }
  }
  texture.update();
  return texture;
}

function createBuilding(scene: Scene, theta: number, radius: number, seed: number): Mesh {
  const width = 18 + (seed % 7) * 1.6;
  const depth = 16 + ((seed >> 3) % 6) * 1.7;
  const height = 15 + ((seed >> 5) % 17) * 1.9;

  const building = MeshBuilder.CreateBox(`building-${seed}`, { width, height, depth }, scene);
  building.position = new Vector3(Math.cos(theta) * radius, height / 2, Math.sin(theta) * radius);
  building.rotation.y = -theta;
  building.material = createBuildingMaterial(scene, seed);
  building.receiveShadows = true;
  markCaster(building);
  return building;
}

function createBuildingMaterial(scene: Scene, seed: number): PBRMaterial {
  const material = new PBRMaterial(`building-mat-${seed}`, scene);
  const facade = createFacadeTexture(scene, seed);
  facade.gammaSpace = false;
  material.albedoTexture = facade;
  material.emissiveTexture = facade;
  material.emissiveColor = new Color3(0.34, 0.34, 0.38);
  material.roughness = 0.6;
  material.metallic = 0.05;
  return material;
}

function createTree(scene: Scene, theta: number, radius: number, seed: number): void {
  const scale = 0.75 + ((seed % 40) / 40) * 0.6;
  const x = Math.cos(theta) * radius;
  const z = Math.sin(theta) * radius;

  const leafMat = new PBRMaterial(`leaf-${seed}`, scene);
  leafMat.albedoColor = new Color3(0.14 + (seed % 10) / 60, 0.26 + (seed % 7) / 40, 0.09);
  leafMat.roughness = 0.95;
  leafMat.metallic = 0;
  const trunkMat = new PBRMaterial(`trunk-${seed}`, scene);
  trunkMat.albedoColor = new Color3(0.32, 0.23, 0.15);
  trunkMat.roughness = 1;

  const trunk = MeshBuilder.CreateCylinder(
    'trunk',
    { diameter: 0.55, height: 3.4, tessellation: 8 },
    scene,
  );
  trunk.position = new Vector3(x, 1.7 * scale, z);
  trunk.scaling.y = scale;
  trunk.material = trunkMat;
  markCaster(trunk);

  const crown = MeshBuilder.CreateSphere('crown', { diameter: 6.4, segments: 10 }, scene);
  crown.position = new Vector3(x, 6.4 * scale, z);
  crown.scaling = new Vector3(scale, scale * 0.82, scale);
  crown.material = leafMat;
  markCaster(crown);
}

function createStopSignTexture(scene: Scene): DynamicTexture {
  const texture = new DynamicTexture('stop-sign', { width: 128, height: 64 }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D | null;
  if (!ctx) return texture;
  ctx.fillStyle = '#0d1017';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#ffb300';
  ctx.font = '800 40px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('24', 64, 34);
  texture.update();
  return texture;
}

function createBusStop(scene: Scene, theta: number, radius: number): void {
  const x = Math.cos(theta) * radius;
  const z = Math.sin(theta) * radius;
  const stop = MeshBuilder.CreateBox('bus-stop', { width: 0.1, height: 0.1, depth: 0.1 }, scene);
  stop.position = new Vector3(x, 0, z);
  stop.isVisible = false;

  const poleMat = new PBRMaterial(`stop-pole-${theta.toFixed(2)}`, scene);
  poleMat.albedoColor = new Color3(0.16, 0.17, 0.2);
  poleMat.roughness = 0.6;

  const glassMat = new PBRMaterial(`stop-glass-${theta.toFixed(2)}`, scene);
  glassMat.albedoColor = new Color3(0.08, 0.09, 0.12);
  glassMat.roughness = 0.15;
  glassMat.metallic = 0.4;

  for (const side of [-1, 1]) {
    const pole = MeshBuilder.CreateCylinder(
      'stop-pole',
      { diameter: 0.1, height: 2.5, tessellation: 8 },
      scene,
    );
    pole.parent = stop;
    pole.position.set(side * 1.05, 1.25, 0);
    pole.material = poleMat;
    markCaster(pole);
  }
  const roof = MeshBuilder.CreateBox('stop-roof', { width: 2.4, height: 0.14, depth: 1.5 }, scene);
  roof.parent = stop;
  roof.position.y = 2.5;
  roof.material = poleMat;
  roof.rotation.y = Math.PI / 2;
  markCaster(roof);

  const panel = MeshBuilder.CreateBox(
    'stop-panel',
    { width: 0.06, height: 1.15, depth: 1.35 },
    scene,
  );
  panel.parent = stop;
  panel.position.set(-0.9, 1.55, 0);
  panel.material = glassMat;
  panel.receiveShadows = true;
  markCaster(panel);

  const signMat = new StandardMaterial(`stop-sign-mat-${theta.toFixed(2)}`, scene);
  signMat.emissiveColor = Color3.White();
  signMat.disableLighting = true;
  signMat.diffuseTexture = createStopSignTexture(scene);
  const sign = MeshBuilder.CreatePlane('stop-sign', { width: 1.5, height: 0.62 }, scene);
  sign.parent = stop;
  sign.position.set(0.02, 2.05, 0.18);
  sign.material = signMat;
}

/**
 * Procedural city around the demo track: a ring of high-rises with lit window
 * facades, street trees and bus shelters on the kerb.
 */
export function createCity(scene: Scene, trackRadius: number): void {
  const BUILDING_COUNT = 20;
  for (let i = 0; i < BUILDING_COUNT; i++) {
    const theta = (i / BUILDING_COUNT) * Math.PI * 2 + (i % 3) * 0.02;
    const radius =
      BUILDING_RING_MIN + ((i * 37) % Math.floor(BUILDING_RING_MAX - BUILDING_RING_MIN));
    createBuilding(scene, theta, radius, i * 7919 + 13);
  }

  const TREE_COUNT = 30;
  for (let i = 0; i < TREE_COUNT; i++) {
    const theta = (i / TREE_COUNT) * Math.PI * 2 + (i % 5) * 0.04;
    const radius =
      i % 3 === 0
        ? 60 + ((i * 53) % 55)
        : TREE_RING_MIN + ((i * 29) % Math.floor(TREE_RING_MAX - TREE_RING_MIN));
    createTree(scene, theta, radius, i * 104729 + 7);
  }

  const STOP_COUNT = 4;
  for (let i = 0; i < STOP_COUNT; i++) {
    createBusStop(scene, (i / STOP_COUNT) * Math.PI * 2 + 0.3, trackRadius + 3.2);
  }
}

export const CITY_BUILDING_RING_MIN = BUILDING_RING_MIN;
export const CITY_TREE_RING_MIN = TREE_RING_MIN;
