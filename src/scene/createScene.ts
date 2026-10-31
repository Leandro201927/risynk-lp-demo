import {
  AgXToneMapping, ColorManagement, Group, Matrix4, Mesh, Object3D, PlaneGeometry, Quaternion, Scene,
  ShaderMaterial, ShadowMaterial, SRGBColorSpace, Vector3, WebGLRenderer, Color,
} from 'three';
import type { StoryState } from './animation/storyState';
import { CameraController } from './camera/CameraController';
import { createTriangleProxy, triangleMetrics, type TriangleProxy } from './geometry/createTriangleProxy';
import { createCylinderProxy, type CylinderProxy } from './geometry/createCylinderProxy';
import { LaunchPath, LAUNCH_SECONDS } from './geometry/launchPath';
import {
  createTriangleBloomMaterial, createTriangleDepthMaterial, createTriangleMaterial, createTriangleUniforms,
} from './materials/createTriangleMaterial';
import {
  createCylinderBloomMaterial, createCylinderDepthMaterial, createCylinderMaterial, createCylinderUniforms,
} from './materials/createCylinderMaterial';
import { createEnvironment, type EnvironmentHandle } from './lighting/createEnvironment';
import { LightingController } from './lighting/LightingController';
import { solveBackground } from './lighting/backgroundMatch';
import { EnergyController } from './energy/EnergyController';
import { OrbitController } from './orbits/OrbitController';
import { buildOrbitSpecs } from './orbits/createOrbitGeometry';
import { ExhaustSystem } from './particles/ExhaustSystem';
import type { QualityConfig } from './quality/qualityProfiles';

export const PAGE_BACKGROUND = '#f2f2f4';
export const EXPOSURE = 1.0;

const Y = new Vector3(0, 1, 0);

/**
 * LiveSceneBackend: la ÚNICA escena lógica. Todos los perfiles de calidad apuntan aquí; solo cambia qualityConfig.
 * Contiene: triángulo, cilindro, órbitas, estela, partículas, señales de energía, luces y entorno.
 */
export class LiveSceneBackend {
  readonly scene = new Scene();
  readonly camera: CameraController;
  readonly triangle: TriangleProxy;
  readonly cylinder: CylinderProxy;
  readonly path: LaunchPath;
  readonly orbits: OrbitController;
  readonly energy: EnergyController;
  readonly exhaust: ExhaustSystem;
  readonly lighting: LightingController;
  private env: EnvironmentHandle;
  private triU = createTriangleUniforms(triangleMetrics());
  private cylU = createCylinderUniforms();
  private shadowCatcher: Mesh;
  private shadowMat: ShadowMaterial;
  private blobMat: ShaderMaterial;
  private disposables: Array<{ dispose(): void }> = [];
  private tmpV = new Vector3();
  private tmpV2 = new Vector3();
  private tmpQ = new Quaternion();
  private qStart = new Quaternion();
  private qPath = new Quaternion();
  private tangent = new Vector3();
  private headWorld = new Vector3();
  private nozzleWorld = new Vector3();
  private fovHalfTan = 0.3;
  drawingBufferHeight = 800;
  pixelRatio = 1;
  reducedMotion = false;

  constructor(private renderer: WebGLRenderer, q: QualityConfig) {
    ColorManagement.enabled = true;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = AgXToneMapping;
    renderer.toneMappingExposure = EXPOSURE;
    LightingController.configureRenderer(renderer);

    // Fondo: color lineal tal que tras AgX + sRGB coincida con la superficie de la página.
    this.scene.background = solveBackground(PAGE_BACKGROUND, EXPOSURE);

    this.env = createEnvironment(renderer);
    this.scene.environment = this.env.texture;
    this.scene.environmentIntensity = 0.85;

    // Triángulo
    const triMat = createTriangleMaterial(this.triU);
    this.triangle = createTriangleProxy(triMat, q);
    this.triangle.mesh.customDepthMaterial = createTriangleDepthMaterial(this.triU);
    const triBloom = createTriangleBloomMaterial(this.triU);
    this.triangle.mesh.userData.bloom = triBloom;
    this.disposables.push(triMat, triBloom, this.triangle.mesh.customDepthMaterial as unknown as { dispose(): void });
    this.scene.add(this.triangle.group);
    this.triangle.group.updateMatrixWorld(true);

    // Trayectoria compartida (cilindro + partículas + cámara + órbitas)
    const topWorld = this.triangle.group.localToWorld((this.triangle.centerline[2] as Vector3).clone());
    this.path = new LaunchPath(topWorld, buildOrbitSpecs()[0]);
    this.orbits = new OrbitController(
      this.path, q,
      this.triangle.centerline.map((v) => this.triangle.group.localToWorld(v.clone())),
    );
    this.scene.add(this.orbits.root);

    // Cilindro
    const cylMat = createCylinderMaterial(this.cylU);
    this.cylinder = createCylinderProxy(cylMat, q);
    this.cylinder.mesh.customDepthMaterial = createCylinderDepthMaterial(this.cylU);
    const cylBloom = createCylinderBloomMaterial(this.cylU);
    this.cylinder.mesh.userData.bloom = cylBloom;
    this.disposables.push(cylMat, cylBloom, this.cylinder.mesh.customDepthMaterial as unknown as { dispose(): void });
    this.cylinder.group.visible = false;
    this.scene.add(this.cylinder.group);

    // Energía (hija del triángulo para heredar su orientación)
    this.energy = new EnergyController(this.triangle, this.triU);
    this.triangle.group.add(this.energy.group);

    // Escape de partículas (mundo)
    const exhaustRoot = new Group();
    exhaustRoot.name = 'Exhaust';
    this.scene.add(exhaustRoot);
    this.exhaust = new ExhaustSystem(this.path, q, exhaustRoot);

    // Sombra de contacto. Tier 0: blob radial barato; resto: ShadowMaterial recibiendo la luz principal.
    this.shadowMat = new ShadowMaterial({ color: new Color('#8A86A3'), opacity: 0.16 });
    this.blobMat = new ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec2 vUv; void main(){ float r=length(vUv-0.5)*2.0; float a=0.16*exp(-r*r*5.0)*(1.0-smoothstep(0.8,1.0,r)); gl_FragColor=vec4(vec3(0.54,0.525,0.64),a);}',
    });
    this.shadowCatcher = new Mesh(new PlaneGeometry(14, 14), q.shadows.contactBlob ? this.blobMat : this.shadowMat);
    this.shadowCatcher.rotation.x = -Math.PI / 2;
    this.shadowCatcher.position.y = -1.45;
    this.shadowCatcher.receiveShadow = true;
    this.shadowCatcher.renderOrder = -1;
    this.shadowCatcher.userData.bloom = 'hide';
    this.scene.add(this.shadowCatcher);

    // TODO: MISSING_FILL(BAKED_LIGHTMAP_ATLAS) MISSING_FILL(BAKED_AO_ATLAS) MISSING_FILL(PRODUCTION_MATERIAL_TEXTURES)
    // MaterialController.applyBakedLighting({ lightMap, aoMap, intensity }) reducirá environmentIntensity y la hemisférica
    // según bakedContribution para no duplicar la luz indirecta.
    this.lighting = new LightingController(this.scene, q);
    this.lighting.setShadows(q, renderer);
    this.camera = new CameraController(this.path);

    // qStart: eje del cilindro alineado con la arista derecha (BR -> TOP) antes del lanzamiento
    const br = this.triangle.group.localToWorld((this.triangle.centerline[1] as Vector3).clone());
    this.qStart.setFromUnitVectors(Y, this.tmpV.subVectors(topWorld, br).normalize());
  }

  setQuality(q: QualityConfig): void {
    this.lighting.setShadows(q, this.renderer);
    this.exhaust.rebuild(q);
    this.orbits.rebuild(q);
    this.shadowCatcher.material = q.shadows.contactBlob ? this.blobMat : this.shadowMat;
    this.shadowCatcher.visible = true;
  }

  worldOf = (o: Object3D, v: Vector3, out: Vector3): Vector3 => {
    o.updateWorldMatrix(true, false);
    return out.copy(v).applyMatrix4(o.matrixWorld as Matrix4);
  };

  /** Aplica StoryState a toda la escena. Determinista: sin dependencia del tiempo de pared salvo `ambient` (solo sombreado). */
  update(s: StoryState, nowSec: number): void {
    const ambient = this.reducedMotion ? 0 : nowSec;
    this.camera.update(s, nowSec);
    this.fovHalfTan = Math.tan((this.camera.camera.fov * Math.PI) / 360);

    // Cilindro: posición sobre la trayectoria compuesta, orientación por tangente (alineación progresiva al inicio)
    const sHead = this.path.qToS(s.cylinderProgress);
    this.path.pointAt(sHead, this.headWorld);
    this.path.tangentAt(sHead, this.tangent);
    this.qPath.setFromUnitVectors(Y, this.tangent);
    this.tmpQ.copy(this.qStart).slerp(this.qPath, s.cylinderAlign);
    const g = this.cylinder.group;
    g.position.copy(this.headWorld);
    g.quaternion.copy(this.tmpQ);
    g.scale.setScalar(0.6 + 0.4 * s.cylinderVisibility);
    g.visible = s.cylinderVisibility > 0.001;
    this.cylU.uDissolve!.value = s.cylinderVisibility;
    this.cylU.uNozzle!.value = s.nozzleGlow;
    this.cylU.uAmbient!.value = ambient;
    this.nozzleWorld.set(0, this.cylinder.nozzleLocalY, 0).applyQuaternion(this.tmpQ).multiplyScalar(g.scale.x).add(this.headWorld);

    // Energía, órbitas, partículas
    this.energy.update(s, this.worldOf, ambient);
    this.energy.anchors.nozzle.copy(this.nozzleWorld);
    this.orbits.update(s, ambient);
    s.exhaustProgress = LAUNCH_SECONDS * sHead;
    this.exhaust.update({
      time: s.exhaustProgress,
      launchProgress: sHead,
      intensity: s.exhaustIntensity,
      turbulence: this.reducedMotion ? 0 : 1,
      ambient,
      pixelRatio: this.pixelRatio,
      projScale: this.drawingBufferHeight / (2 * this.fovHalfTan),
    });
    this.lighting.update(s, this.energy.anchors, s.cylinderVisibility > 0.5 ? this.nozzleWorld : null);
    void this.tmpV2;
  }

  dispose(): void {
    this.scene.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose?.();
    });
    this.triangle.dispose();
    this.cylinder.dispose();
    this.exhaust.dispose();
    this.orbits.dispose();
    this.energy.dispose();
    this.lighting.dispose();
    this.path.dispose();
    this.env.dispose();
    this.shadowMat.dispose();
    this.blobMat.dispose();
    this.shadowCatcher.geometry.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
