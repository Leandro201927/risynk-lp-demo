import { CanvasTexture, CircleGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, SRGBColorSpace, Color } from 'three';

/**
 * Fichas de integraciones que viajan sobre las órbitas. Las marcas se dibujan como glifos procedurales simplificados
 * (sin assets externos ni logotipos con derechos): moneda de cerámica nacarada con el glifo en ambas caras.
 * TODO: MISSING_FILL(INTEGRATION_LOGOS) — sustituir cada glifo por el logotipo oficial (SVG/PNG) manteniendo `id`.
 */
type Draw = (c: CanvasRenderingContext2D) => void;

const INK = '#1D2133';
const CYAN = '#2FB8DA';
const S = 256;

const stroke = (c: CanvasRenderingContext2D, w = 14): void => {
  c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = INK; c.stroke();
};
const letter = (c: CanvasRenderingContext2D, ch: string, size = 150): void => {
  c.fillStyle = INK; c.font = `700 ${size}px Inter, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(ch, S / 2, S / 2 + size * 0.04);
};

const GLYPHS: Record<string, Draw> = {
  google: (c) => letter(c, 'G'),
  instagram: (c) => {
    c.beginPath(); c.roundRect(62, 62, 132, 132, 36); stroke(c);
    c.beginPath(); c.arc(128, 128, 30, 0, Math.PI * 2); stroke(c);
    c.beginPath(); c.arc(166, 90, 6, 0, Math.PI * 2); c.fillStyle = CYAN; c.fill();
  },
  meta: (c) => {
    c.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * Math.PI * 2, d = 1 + Math.sin(t) ** 2;
      const x = S / 2 + (70 * Math.cos(t)) / d, y = S / 2 + (92 * Math.sin(t) * Math.cos(t)) / d;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    stroke(c, 18);
  },
  whatsapp: (c) => {
    c.beginPath(); c.arc(128, 124, 62, 0.35 * Math.PI, 2.3 * Math.PI); c.lineTo(76, 196); c.closePath(); stroke(c);
    c.beginPath(); c.moveTo(106, 104); c.lineTo(150, 148); stroke(c, 18);
  },
  gmail: (c) => {
    c.beginPath(); c.roundRect(56, 80, 144, 98, 12); stroke(c);
    c.beginPath(); c.moveTo(60, 88); c.lineTo(128, 144); c.lineTo(196, 88); stroke(c);
  },
  slack: (c) => {
    for (const [x0, y0, x1, y1] of [[100, 66, 90, 190], [160, 66, 150, 190], [66, 104, 190, 104], [66, 152, 190, 152]] as const) {
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); stroke(c, 16);
    }
  },
  analytics: (c) => {
    c.fillStyle = INK;
    for (const [x, h] of [[72, 56], [112, 100], [152, 140]] as const) { c.beginPath(); c.roundRect(x, 190 - h, 30, h, 8); c.fill(); }
    c.beginPath(); c.arc(182, 74, 9, 0, Math.PI * 2); c.fillStyle = CYAN; c.fill();
  },
  stripe: (c) => letter(c, 'S'),
  shopify: (c) => {
    c.beginPath(); c.roundRect(72, 106, 112, 88, 14); stroke(c);
    c.beginPath(); c.arc(128, 106, 30, Math.PI, 0); stroke(c);
  },
};

export const INTEGRATIONS_BY_ORBIT: string[][] = [
  ['google', 'instagram', 'meta'], // Visibilidad
  ['whatsapp', 'gmail', 'slack'], // Relaciones
  ['analytics', 'stripe', 'shopify'], // Resultados
];

function faceTexture(id: string): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(100, 90, 20, 128, 128, 130);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#E6E6EF');
  c.fillStyle = g; c.beginPath(); c.arc(128, 128, 126, 0, Math.PI * 2); c.fill();
  c.strokeStyle = CYAN; c.lineWidth = 7; c.beginPath(); c.arc(128, 128, 116, 0, Math.PI * 2); c.stroke();
  GLYPHS[id]!(c);
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export interface IntegrationToken {
  id: string;
  group: Group;
}

export class IntegrationTokenFactory {
  private textures = new Map<string, CanvasTexture>();
  private faceMats = new Map<string, MeshBasicMaterial>();
  private body = new MeshPhysicalMaterial({ color: new Color('#EDEDF3'), roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.15 });
  private bodyGeo = new CylinderGeometry(0.22, 0.22, 0.05, 40).rotateX(Math.PI / 2); // eje del disco = z local
  private faceGeo = new CircleGeometry(0.205, 40);

  create(id: string): IntegrationToken {
    let mat = this.faceMats.get(id);
    if (!mat) {
      const map = faceTexture(id);
      this.textures.set(id, map);
      mat = new MeshBasicMaterial({ map });
      this.faceMats.set(id, mat);
    }
    const group = new Group();
    group.name = `Integration_${id}`;
    group.add(new Mesh(this.bodyGeo, this.body));
    const front = new Mesh(this.faceGeo, mat);
    front.position.z = 0.0255;
    const back = new Mesh(this.faceGeo, mat);
    back.position.z = -0.0255;
    back.rotation.y = Math.PI; // la cara trasera se lee correctamente (no en espejo)
    group.add(front, back);
    return { id, group };
  }

  dispose(): void {
    this.textures.forEach((t) => t.dispose());
    this.faceMats.forEach((m) => m.dispose());
    this.body.dispose(); this.bodyGeo.dispose(); this.faceGeo.dispose();
  }
}
