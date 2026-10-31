import { Color, Group, LatheGeometry, Mesh, MeshPhysicalMaterial, ShaderMaterial, TorusGeometry, Vector2, type Material } from 'three';
import { APEX_TOP_Y } from './createTriangleProxy';
import { PALETTE } from '../materials/createTriangleMaterial';

/** Cuna de lanzamiento asentada en la cara plana del vértice superior. El cohete reposa en ella antes de separarse. */
export const MOUNT = {
  baseY: APEX_TOP_Y,
  height: 0.17,
  /** Altura sobre baseY a la que apoya la tobera del cohete. */
  seat: 0.13,
};

export interface LaunchMount {
  group: Group;
  setCharge: (v: number) => void;
  dispose: () => void;
}

export function createLaunchMount(occluder: Material): LaunchMount {
  const group = new Group();
  group.name = 'LaunchMount';
  group.position.set(0, MOUNT.baseY, 0);

  // Perfil de torno: pedestal estrecho que se abre en una copa (taza) donde asienta la tobera.
  const profile = [
    [0.0, 0.0], [0.082, 0.0], [0.082, 0.05], [0.1, 0.085], [0.15, 0.13], [0.158, 0.145], [0.152, 0.165],
    [0.13, 0.17], [0.122, 0.15], [0.1, 0.13], [0.0, 0.13],
  ].map(([r, y]) => new Vector2(r, y));
  const mat = new MeshPhysicalMaterial({
    color: new Color('#EDEDF3'), roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.12,
    sheen: 0.3, sheenColor: new Color(PALETTE.violet),
  });
  const body = new Mesh(new LatheGeometry(profile, 48), mat);
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData.bloom = occluder;
  group.add(body);

  const ringMat = new ShaderMaterial({
    uniforms: { uCharge: { value: 0 }, uCyan: { value: new Color(PALETTE.cyan) } },
    vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uCharge; uniform vec3 uCyan; void main(){ gl_FragColor = vec4(mix(vec3(0.62,0.66,0.74), uCyan * 1.15, clamp(uCharge,0.0,1.0)) * (0.35 + 0.9 * clamp(uCharge,0.0,1.6)), 1.0); }',
  });
  const ring = new Mesh(new TorusGeometry(0.139, 0.0065, 8, 56), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.158;
  ring.userData.bloom = 'self';
  group.add(ring);

  return {
    group,
    setCharge: (v) => { ringMat.uniforms.uCharge!.value = v; },
    dispose: () => { body.geometry.dispose(); ring.geometry.dispose(); mat.dispose(); ringMat.dispose(); },
  };
}
