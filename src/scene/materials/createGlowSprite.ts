import { Color, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { GLOW_FRAGMENT, GLOW_VERTEX } from './shaderChunks';

/** Billboard de luz (mote de energía, destello central, onda de halo). No es un objeto físico. */
export interface GlowSprite {
  mesh: Mesh;
  material: ShaderMaterial;
  set: (size: number, intensity: number, ring?: number) => void;
  dispose: () => void;
}

const sharedGeometry = new PlaneGeometry(1, 1);

export function createGlowSprite(color: string): GlowSprite {
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uSize: { value: 0 },
      uColor: { value: new Color(color) },
      uIntensity: { value: 0 },
      uRing: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: GLOW_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
  });
  material.blending = 1; // NormalBlending; el brillo viene del bloom selectivo
  const mesh = new Mesh(sharedGeometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.visible = false;
  return {
    mesh,
    material,
    set(size, intensity, ring = 0) {
      mesh.visible = intensity > 0.002 && size > 0.0001;
      material.uniforms.uSize!.value = size;
      material.uniforms.uIntensity!.value = intensity;
      material.uniforms.uRing!.value = ring;
    },
    dispose: () => material.dispose(),
  };
}
