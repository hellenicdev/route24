import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { SkyMaterial } from '@babylonjs/materials/sky/skyMaterial';
import { ReflectionProbe } from '@babylonjs/core/Probes/reflectionProbe';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';

export interface SceneHandle {
  scene: Scene;
  camera: ArcRotateCamera;
  sun: DirectionalLight;
  sunMesh: Mesh;
}

export interface SceneFactoryOptions {
  /** HTML canvas to attach camera controls to. */
  canvas: HTMLCanvasElement;
}

const TRACK_RADIUS = 150;
const TRACK_LANE_WIDTH = 15;
const GROUND_SIZE = 340;
const GROUND_SUBDIVISIONS = 96;
const SKY_DOME_RADIUS = 4000;

/**
 * Draws the demo track onto a square dynamic texture.
 * Track is a circle of radius TRACK_RADIUS (m) with a painted lane ring.
 * Canvas pixels map 1:1 to world metres along X (square canvas over a square
 * ground), so all sizes below are expressed in metres.
 */
function createTrackTexture(scene: Scene, size = 1024): DynamicTexture {
  const texture = new DynamicTexture('track', { width: size, height: size }, scene, false);
  // getContext() is typed as Babylon's minimal ICanvasRenderingContext, but in
  // browsers it is a full CanvasRenderingContext2D (documented Babylon behavior).
  const ctx = texture.getContext() as CanvasRenderingContext2D | null;
  if (!ctx) return texture;

  // Asphalt base with speckle noise.
  ctx.fillStyle = '#3a3e45';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) {
    const shade = 42 + Math.floor(Math.random() * 58);
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade + 5}, 0.55)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }

  const pxPerMeter = size / GROUND_SIZE;
  const R = TRACK_RADIUS * pxPerMeter;
  const lane = TRACK_LANE_WIDTH * pxPerMeter;

  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = 'rgba(240, 240, 240, 0.92)';
  ctx.lineCap = 'round';

  // Edge lines.
  ctx.lineWidth = Math.max(2, lane * 0.08);
  for (const edge of [1, -1]) {
    ctx.beginPath();
    ctx.arc(0, 0, R + edge * lane * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Dashed centre line.
  ctx.setLineDash([lane * 0.3, lane * 0.24]);
  ctx.lineWidth = Math.max(2, lane * 0.1);
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Start/finish checkers across the lane at world +X.
  const cells = 12;
  const cellSize = lane / cells;
  for (let i = 0; i < cells; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#f0f0f0' : '#16181c';
    ctx.fillRect(R - lane / 2 + i * cellSize, -lane * 0.06, cellSize, lane * 0.12);
  }

  ctx.restore();
  texture.update();
  return texture;
}

function createSignTexture(scene: Scene, text: string, width = 512, height = 192): DynamicTexture {
  const texture = new DynamicTexture('sign', { width, height }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D | null;
  if (!ctx) return texture;
  ctx.fillStyle = '#10131a';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffb300';
  ctx.font = `900 ${Math.floor(height * 0.42)}px 'Segoe UI', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + height * 0.04);
  texture.update();
  return texture;
}

function createAsphaltMaterial(scene: Scene): PBRMaterial {
  const material = new PBRMaterial('asphalt', scene);
  material.albedoColor = Color3.White();
  const albedo = createTrackTexture(scene);
  // Linear space: Babylon 9.19's WebGPU geometry shader miscompiles the
  // GAMMAALBEDO path (toLinearSpaceVec4 called with vec3), breaking the
  // SSAO/SSR gBuffer pass. WebGL2 is unaffected by this flag.
  albedo.gammaSpace = false;
  material.albedoTexture = albedo;
  material.roughness = 0.92;
  material.metallic = 0;
  return material;
}

function createCurbMesh(scene: Scene, theta: number, radiusOffset: number): Mesh {
  const curb = MeshBuilder.CreateBox(
    `curb-${theta.toFixed(2)}`,
    { width: 6, height: 0.32, depth: 0.6 },
    scene,
  );
  curb.position = new Vector3(
    Math.cos(theta) * (TRACK_RADIUS + radiusOffset),
    0.16,
    Math.sin(theta) * (TRACK_RADIUS + radiusOffset),
  );
  curb.rotation.y = -theta;
  curb.material = createCurbMaterial(scene);
  curb.receiveShadows = true;
  curb.metadata = { castsShadow: true };
  return curb;
}

function createCurbMaterial(scene: Scene): PBRMaterial {
  const material = new PBRMaterial('curb', scene);
  material.albedoColor = new Color3(0.45, 0.45, 0.48);
  material.roughness = 0.75;
  material.metallic = 0.05;
  return material;
}

function createStreetlight(scene: Scene, theta: number, radius: number): Mesh {
  const root = MeshBuilder.CreateBox(
    `light-root-${theta.toFixed(2)}`,
    { width: 0.3, height: 0.3, depth: 0.3 },
    scene,
  );
  root.position = new Vector3(Math.cos(theta) * radius, 0.15, Math.sin(theta) * radius);
  root.isVisible = false;

  const poleMat = createCurbMaterial(scene);

  const pole = MeshBuilder.CreateCylinder('pole', { diameter: 0.22, height: 7.5 }, scene);
  pole.parent = root;
  pole.position.y = 7.5 / 2;
  pole.material = poleMat;
  pole.metadata = { castsShadow: true };

  const arm = MeshBuilder.CreateBox('arm', { width: 2.2, height: 0.18, depth: 0.18 }, scene);
  arm.parent = root;
  arm.position = new Vector3(-1.1, 7.4, 0);
  arm.rotation.z = -0.08;
  arm.material = poleMat;
  arm.metadata = { castsShadow: true };

  const headMat = new StandardMaterial('light-head', scene);
  headMat.emissiveColor = new Color3(1, 0.82, 0.55);
  headMat.disableLighting = true;

  const head = MeshBuilder.CreateSphere('head', { diameter: 0.5, segments: 12 }, scene);
  head.parent = root;
  head.position = new Vector3(-2.15, 7.25, 0);
  head.scaling = new Vector3(0.8, 0.35, 0.35);
  head.material = headMat;
  head.metadata = { castsShadow: false };
  return root;
}

function createShowcaseObjects(scene: Scene, probe: ReflectionProbe): void {
  const paintMat = new PBRMaterial('paint-showcase', scene);
  paintMat.albedoColor = new Color3(0.62, 0.06, 0.09);
  paintMat.metallic = 0.25;
  paintMat.roughness = 0.28;
  paintMat.clearCoat.isEnabled = true;
  paintMat.clearCoat.intensity = 1;
  paintMat.clearCoat.roughness = 0.12;

  const sphere = MeshBuilder.CreateSphere('paint-demo', { diameter: 5, segments: 48 }, scene);
  sphere.position = new Vector3(12, 2.5, 2);
  sphere.material = paintMat;
  sphere.metadata = { castsShadow: true };
  sphere.receiveShadows = true;

  const glassMat = new PBRMaterial('glass-showcase', scene);
  glassMat.albedoColor = new Color3(0.05, 0.06, 0.08);
  glassMat.metallic = 1;
  glassMat.roughness = 0.05;

  const glassBox = MeshBuilder.CreateBox('glass-demo', { size: 5 }, scene);
  glassBox.position = new Vector3(-14, 2.5, 8);
  glassBox.material = glassMat;
  glassBox.metadata = { castsShadow: true };
  glassBox.receiveShadows = true;

  const matteMat = new PBRMaterial('matte-showcase', scene);
  matteMat.albedoColor = new Color3(0.85, 0.83, 0.78);
  matteMat.roughness = 1;
  matteMat.metallic = 0;

  const matteBox = MeshBuilder.CreateBox('matte-demo', { width: 4, height: 4, depth: 4 }, scene);
  matteBox.position = new Vector3(0, 2, 16);
  matteBox.material = matteMat;
  matteBox.metadata = { castsShadow: true };
  matteBox.receiveShadows = true;

  probe.attachToMesh(sphere);
  probe.renderList = [sphere, glassBox, matteBox];
}

function createRouteSign(scene: Scene): Mesh {
  const signMat = new PBRMaterial('route-sign', scene);
  signMat.albedoColor = new Color3(0.05, 0.06, 0.09);
  signMat.roughness = 0.6;
  signMat.metallic = 0;
  signMat.emissiveColor = Color3.White();
  signMat.emissiveTexture = createSignTexture(scene, 'ROUTE 24');

  const sign = MeshBuilder.CreatePlane('route-sign-mesh', { width: 22, height: 8 }, scene);
  sign.position = new Vector3(0, 9, -(TRACK_RADIUS + 26));
  sign.rotation.x = Math.PI / 2 - 0.12;
  sign.material = signMat;
  sign.metadata = { castsShadow: false };

  const poles = MeshBuilder.CreateCylinder(
    'sign-pole',
    { diameter: 0.35, height: 9, tessellation: 8 },
    scene,
  );
  poles.position = new Vector3(0, 4.5, -(TRACK_RADIUS + 27));
  poles.material = createCurbMaterial(scene);
  poles.metadata = { castsShadow: true };
  return sign;
}

/**
 * Builds the M0 showcase scene: sky, sun, ground track, curbs, streetlights,
 * PBR showcase objects and a reflection probe. The world itself is rebuilt in
 * the vehicle milestone — this exists to validate the rendering stack.
 */
export function createM0Scene(engine: AbstractEngine, options: SceneFactoryOptions): SceneHandle {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.085, 0.11, 0.16, 1);
  scene.ambientColor = new Color3(0.28, 0.3, 0.36);
  scene.environmentIntensity = 1;

  // Sky
  const skyMaterial = new SkyMaterial('sky', scene);
  skyMaterial.turbidity = 6;
  skyMaterial.luminance = 0.55;
  skyMaterial.fogEnabled = false;
  const skyDome = MeshBuilder.CreateSphere(
    'sky-dome',
    { diameter: SKY_DOME_RADIUS, segments: 8, sideOrientation: 1 },
    scene,
  );
  skyDome.material = skyMaterial;
  skyDome.isPickable = false;
  skyDome.infiniteDistance = true;

  // Lights
  const sun = new DirectionalLight('sun', new Vector3(0.55, 0.42, 0.3), scene);
  sun.intensity = 3.2;
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.42;
  hemi.groundColor = new Color3(0.26, 0.27, 0.31);

  // Sun mesh (god-ray source for the volumetric effect).
  const sunMesh = MeshBuilder.CreateSphere('sun-mesh', { diameter: 36, segments: 16 }, scene);
  sunMesh.position = sun.direction.scale(1200);
  sunMesh.freezeWorldMatrix();
  const sunMat = new StandardMaterial('sun-mat', scene);
  sunMat.emissiveColor = new Color3(1, 0.9, 0.7);
  sunMat.disableLighting = true;
  sunMesh.material = sunMat;
  sunMesh.isPickable = false;

  // Camera
  const camera = new ArcRotateCamera('camera', 0.75, 1.02, 95, new Vector3(0, 2, 0), scene);
  camera.attachControl(options.canvas, true);
  camera.fov = 0.85;
  camera.minZ = 0.1;
  camera.lowerRadiusLimit = 18;
  camera.upperRadiusLimit = 420;
  camera.lowerBetaLimit = 0.25;
  camera.upperBetaLimit = 1.45;
  camera.wheelPrecision = 25;
  scene.activeCamera = camera;

  // Ground track
  const ground = MeshBuilder.CreateGround(
    'ground',
    { width: GROUND_SIZE, height: GROUND_SIZE, subdivisions: GROUND_SUBDIVISIONS },
    scene,
  );
  ground.material = createAsphaltMaterial(scene);
  ground.receiveShadows = true;

  // Curbs + streetlights around the loop.
  const CUB_COUNT = 40;
  for (let i = 0; i < CUB_COUNT; i++) {
    createCurbMesh(scene, (i / CUB_COUNT) * Math.PI * 2, 3.2);
  }
  const LIGHT_COUNT = 12;
  for (let i = 0; i < LIGHT_COUNT; i++) {
    createStreetlight(scene, (i / LIGHT_COUNT) * Math.PI * 2, TRACK_RADIUS + 30);
  }

  createRouteSign(scene);

  // Reflection probe over the showcase objects (reflection for the paint).
  const probe = new ReflectionProbe('probe', 128, scene);
  probe.refreshRate = 2;
  createShowcaseObjects(scene, probe);

  return { scene, camera, sun, sunMesh };
}
