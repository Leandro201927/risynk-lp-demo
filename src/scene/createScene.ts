import {
  AgXToneMapping, ColorManagement, Group, Matrix4, Mesh, Object3D, PlaneGeometry, Quaternion, Scene,
  MeshPhysicalMaterial, ShaderMaterial, ShadowMaterial, SRGBColorSpace, Vector3, WebGLRenderer, Color,
} from 'three';
import type { StoryState } from './animation/storyState';
import { CameraController } from './camera/CameraController';
import { createTriangleProxy, triangleMetrics, type TriangleProxy } from './geometry/createTriangleProxy';
import { createCylinderProxy, CYL, type CylinderProxy } from './geometry/createCylinderProxy';
import { createStorefront, type Storefront } from './geometry/createStorefront';
import { createLaunchMount, MOUNT, type LaunchMount } from './geometry/createLaunchMount';
import { LaunchPath, LAUNCH_SECONDS } from './geometry/launchPath';
import {
  beamUniforms, createTriangleBloomMaterial, createTriangleDepthMaterial, createTriangleMaterial, createTriangleUniforms,
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
export const EXPOSURE = 1.3;

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
  private triU = createTriangleUniforms();
  readonly storefront: Storefront;
  readonly mount: LaunchMount;
  private contactBlob: Mesh;
  private cylU = createCylinderUniforms();
  private shadowCatcher: Mesh;
  private shadowMat: ShadowMaterial;
  private blobMat: ShaderMaterial;
  private disposables: Array<{ dispose(): void }> = [];
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
    this.scene.environmentIntensity = 0.6;

    // Oclusor negro para la pasada de bloom (volúmenes sólidos que no deben emitir pero sí tapar emisión).
    const occluder = new ShaderMaterial({ vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'void main(){ gl_FragColor = vec4(0.0,0.0,0.0,1.0); }' });
    this.disposables.push(occluder);

    // Triángulo: tres vigas, cada una con sus uniforms de arista (materiales, profundidad y bloom propios).
    const metrics = triangleMetrics();
    const beamU = [0, 1, 2].map((k) => beamUniforms(this.triU, metrics, k));
    const triMats = beamU.map((u) => createTriangleMaterial(u)) as unknown as [MeshPhysicalMaterial, MeshPhysicalMaterial, MeshPhysicalMaterial];
    this.triangle = createTriangleProxy(triMats, q);
    this.triangle.meshes.forEach((mesh, k) => {
      const depth = createTriangleDepthMaterial(beamU[k] as typeof this.triU);
      const bloom = createTriangleBloomMaterial(beamU[k] as typeof this.triU);
      mesh.customDepthMaterial = depth;
      mesh.userData.bloom = bloom;
      this.disposables.push(triMats[k]!, depth, bloom);
    });
    this.scene.add(this.triangle.group);
    this.triangle.group.updateMatrixWorld(true);

    // Fachada procedural (escena 01/04) y cuna de lanzamiento en el vértice superior (escena 05/06).
    this.storefront = createStorefront(occluder);
    this.triangle.group.add(this.storefront.group);
    this.mount = createLaunchMount(occluder);
    this.triangle.group.add(this.mount.group);

    // Trayectoria compartida (cilindro + partículas + cámara + órbitas)
    // El cohete reposa en la cuna del vértice: su tobera asienta a MOUNT.seat sobre la cara plana del ápice.
    const restPos = new Vector3(0, MOUNT.baseY + MOUNT.seat + CYL.height / 2, 0);
    this.path = new LaunchPath(restPos, buildOrbitSpecs()[0]);
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

    // Sombra de contacto: mancha elíptica muy suave bajo la base (siempre) + sombra proyectada de la luz principal
    // sobre el plano de apoyo (tiers con sombras). Sitúa la escultura en el espacio sin parecer un reflejo.
    const GROUND_Y = -0.7;
    this.shadowMat = new ShadowMaterial({ color: new Color('#7F7A9E'), opacity: 0.2 });
    // Plano grande con gaussiana elíptica EN ESPACIO MUNDO: sus bordes quedan fuera de campo (un plano pequeño
    // entra en la pasada de normales/profundidad del AO y dibuja un rectángulo).
    this.blobMat = new ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec2 vP; void main(){ vec2 e = vec2(vP.x / 2.0, vP.y / 0.7); float a = 0.2 * exp(-dot(e, e) * 1.1); gl_FragColor = vec4(vec3(0.46,0.44,0.62), a);}',
    });
    this.contactBlob = new Mesh(new PlaneGeometry(14, 14), this.blobMat);
    this.contactBlob.rotation.x = -Math.PI / 2;
    this.contactBlob.position.set(0.1, GROUND_Y + 0.002, 0.15);
    this.contactBlob.renderOrder = -2;
    this.contactBlob.userData.bloom = 'hide';
    this.contactBlob.userData.noDepth = true;
    this.scene.add(this.contactBlob);
    this.shadowCatcher = new Mesh(new PlaneGeometry(14, 14), this.shadowMat);
    this.shadowCatcher.rotation.x = -Math.PI / 2;
    this.shadowCatcher.position.y = GROUND_Y;
    this.shadowCatcher.receiveShadow = true;
    this.shadowCatcher.renderOrder = -1;
    this.shadowCatcher.userData.bloom = 'hide';
    this.shadowCatcher.userData.noDepth = true;
    this.shadowCatcher.visible = q.shadows.enabled;
    this.scene.add(this.shadowCatcher);

    // TODO: MISSING_FILL(BAKED_LIGHTMAP_ATLAS) MISSING_FILL(BAKED_AO_ATLAS) MISSING_FILL(PRODUCTION_MATERIAL_TEXTURES)
    // MaterialController.applyBakedLighting({ lightMap, aoMap, intensity }) reducirá environmentIntensity y la hemisférica
    // según bakedContribution para no duplicar la luz indirecta.
    this.lighting = new LightingController(this.scene, q);
    this.lighting.setShadows(q, renderer);
    this.camera = new CameraController(this.path);

    // qStart: el cohete reposa vertical en su cuna (eje del vértice) y se orienta con la trayectoria al separarse.
    this.qStart.identity();
  }

  setQuality(q: QualityConfig): void {
    this.lighting.setShadows(q, this.renderer);
    this.exhaust.rebuild(q);
    this.orbits.rebuild(q);
    this.shadowCatcher.visible = q.shadows.enabled;
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
    g.scale.setScalar(1);
    g.visible = s.cylinderVisibility > 0.001;
    this.cylU.uDissolve!.value = s.cylinderVisibility;
    this.cylU.uNozzle!.value = s.nozzleGlow;
    this.cylU.uAmbient!.value = ambient;
    this.storefront.setState(0.72 + 0.28 * s.coreFlash, s.storeEnergy);
    this.mount.setCharge(Math.min(1.4, s.vertexCharge));
    this.mount.group.visible = s.triangleReveal > 0.66; // la cuna aparece cuando la viga ya ha llegado al vértice
    this.nozzleWorld.set(0, this.cylinder.nozzleLocalY, 0).applyQuaternion(this.tmpQ).add(this.headWorld);

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
    this.storefront.dispose();
    this.mount.dispose();
    this.contactBlob.geometry.dispose();
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
