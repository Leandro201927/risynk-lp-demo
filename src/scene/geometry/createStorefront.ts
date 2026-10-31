import { BoxGeometry, Color, Group, Mesh, MeshPhysicalMaterial, ShaderMaterial, type Material } from 'three';
import { FLOOR_Y } from './createTriangleProxy';
import { PALETTE } from '../materials/createTriangleMaterial';

/**
 * Fachada procedural mínima: plinto, volumen, marco de acceso, marquesina y zonas de luz. Es el símbolo del
 * negocio dentro de la estructura (escena 01) y el nodo central que recibe la energía (escena 04).
 * Origen en el centro de la base, apoyada sobre la cara interior de la viga inferior; frente hacia +Z.
 */
export const STORE = {
  width: 0.5, height: 0.36, depth: 0.27,
  /** Centro de la zona de luz de la puerta, en coordenadas de mundo (el grupo del triángulo no rota). */
  doorCenter: [0, FLOOR_Y + 0.04 + 0.12, 0.145] as [number, number, number],
};

export interface Storefront {
  group: Group;
  /** lit: intensidad de la zona de luz (0..1). energy: tinte cian por energía recibida (0..1). */
  setState: (lit: number, energy: number) => void;
  dispose: () => void;
}

export function createStorefront(occluder: Material): Storefront {
  const group = new Group();
  group.name = 'Storefront';
  group.position.set(0, FLOOR_Y, 0);

  const pearl = new MeshPhysicalMaterial({
    color: new Color('#F1F1F6'), roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.2,
    sheen: 0.3, sheenColor: new Color(PALETTE.violet), envMapIntensity: 0.85,
  });
  const shade = pearl.clone();
  shade.color = new Color('#CBC8DC'); // volumen principal ligeramente más frío para separar planos

  const light = new ShaderMaterial({
    uniforms: { uLit: { value: 0.7 }, uEnergy: { value: 0 }, uCyan: { value: new Color(PALETTE.cyan) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uLit; uniform float uEnergy; uniform vec3 uCyan; varying vec2 vUv;
void main() {
  float g = mix(0.78, 1.12, vUv.y);                       // la luz cae desde el dintel
  vec3 warm = vec3(1.0, 0.985, 0.95) * g * (1.1 + 1.5 * uLit);
  vec3 cy = uCyan * (1.0 + 0.4 * uLit) * g;
  gl_FragColor = vec4(mix(warm, cy, uEnergy * 0.5), 1.0);
}`,
  });

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: Material, bloom?: Material | 'self'): Mesh => {
    const mesh = new Mesh(new BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.bloom = bloom ?? occluder;
    group.add(mesh);
    return mesh;
  };

  const { width: W, height: H, depth: D } = STORE;
  box(W + 0.1, 0.04, D + 0.08, 0, 0.02, 0, pearl); // plinto
  box(W, H, D, 0, 0.04 + H / 2, 0, shade); // volumen
  box(0.19, 0.25, 0.01, 0, 0.04 + 0.125, D / 2 + 0.002, light, 'self'); // zona de luz de la puerta
  box(0.27, 0.03, 0.035, 0, 0.04 + 0.265, D / 2 + 0.012, pearl); // dintel
  box(0.03, 0.26, 0.035, -0.12, 0.04 + 0.13, D / 2 + 0.012, pearl); // jambas
  box(0.03, 0.26, 0.035, 0.12, 0.04 + 0.13, D / 2 + 0.012, pearl);
  box(0.1, 0.12, 0.01, -0.175, 0.04 + 0.2, D / 2 + 0.002, light, 'self'); // escaparate
  box(0.58, 0.022, 0.2, 0, 0.04 + H + 0.011, D / 2 - 0.02, pearl); // marquesina / cubierta

  return {
    group,
    setState: (lit, energy) => {
      light.uniforms.uLit!.value = lit;
      light.uniforms.uEnergy!.value = energy;
    },
    dispose: () => {
      pearl.dispose(); shade.dispose(); light.dispose();
      group.traverse((o) => (o as Mesh).geometry?.dispose?.());
    },
  };
}
