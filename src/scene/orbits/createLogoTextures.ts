import { CanvasTexture, SRGBColorSpace } from 'three';

const S = 256;

type Painter = (c: CanvasRenderingContext2D) => void;

/** Glifos simplificados de integraciones, dibujados proceduralmente (sin assets externos). */
const GLYPHS: Array<{ bg: string; paint: Painter }> = [
  { // Mensajería (burbuja)
    bg: '#25D366',
    paint: (c) => {
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(128, 124, 56, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(84, 160); c.lineTo(76, 192); c.lineTo(110, 176); c.fill();
      c.fillStyle = '#25D366';
      c.beginPath(); c.arc(128, 124, 36, 0, Math.PI * 2); c.fill();
    },
  },
  { // Correo
    bg: '#EA4335',
    paint: (c) => {
      c.strokeStyle = '#fff'; c.lineWidth = 12; c.lineJoin = 'round';
      c.strokeRect(78, 94, 100, 70);
      c.beginPath(); c.moveTo(78, 98); c.lineTo(128, 140); c.lineTo(178, 98); c.stroke();
    },
  },
  { // Calendario
    bg: '#4285F4',
    paint: (c) => {
      c.fillStyle = '#fff';
      c.beginPath(); c.roundRect(76, 80, 104, 100, 12); c.fill();
      c.fillStyle = '#1a5fd0'; c.fillRect(76, 80, 104, 28);
      c.fillStyle = '#4285F4';
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) c.fillRect(88 + i * 30, 122 + j * 24, 20, 14);
    },
  },
  { // Analítica (barras)
    bg: '#F9AB00',
    paint: (c) => {
      c.fillStyle = '#fff';
      c.beginPath(); c.roundRect(82, 130, 24, 48, 10); c.fill();
      c.beginPath(); c.roundRect(116, 104, 24, 74, 10); c.fill();
      c.beginPath(); c.roundRect(150, 76, 24, 102, 10); c.fill();
    },
  },
  { // Canal social (cámara)
    bg: '#C13584',
    paint: (c) => {
      c.strokeStyle = '#fff'; c.lineWidth = 11;
      c.beginPath(); c.roundRect(78, 78, 100, 100, 28); c.stroke();
      c.beginPath(); c.arc(128, 128, 24, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(158, 98, 6, 0, Math.PI * 2); c.fill();
    },
  },
  { // Pagos
    bg: '#635BFF',
    paint: (c) => {
      c.fillStyle = '#fff'; c.font = '700 120px Inter, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('S', 128, 134);
    },
  },
  { // Comercio (bolsa)
    bg: '#5E8E3E',
    paint: (c) => {
      c.fillStyle = '#fff';
      c.beginPath(); c.roundRect(82, 100, 92, 80, 10); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 10;
      c.beginPath(); c.arc(128, 100, 24, Math.PI, 0); c.stroke();
    },
  },
  { // Canal de equipo (almohadilla)
    bg: '#4A154B',
    paint: (c) => {
      c.strokeStyle = '#fff'; c.lineWidth = 12; c.lineCap = 'round';
      for (const [x1, y1, x2, y2] of [[110, 82, 100, 174], [150, 82, 140, 174], [80, 112, 176, 112], [76, 146, 172, 146]] as const) {
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      }
    },
  },
  { // CRM (nodos)
    bg: '#FF7A59',
    paint: (c) => {
      c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = 9;
      const pts: Array<[number, number]> = [[128, 88], [92, 156], [164, 156]];
      c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke();
      for (const [x, y] of pts) { c.beginPath(); c.arc(x, y, 15, 0, Math.PI * 2); c.fill(); }
    },
  },
];

export const LOGO_COUNT = GLYPHS.length;

export function createLogoTexture(index: number): CanvasTexture {
  const g = GLYPHS[index % GLYPHS.length] as (typeof GLYPHS)[number];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const c = canvas.getContext('2d') as CanvasRenderingContext2D;
  c.clearRect(0, 0, S, S);
  // Anillo exterior blanco + disco de color de marca.
  c.fillStyle = '#ffffff';
  c.beginPath(); c.arc(128, 128, 124, 0, Math.PI * 2); c.fill();
  c.fillStyle = g.bg;
  c.beginPath(); c.arc(128, 128, 110, 0, Math.PI * 2); c.fill();
  c.save();
  c.beginPath(); c.arc(128, 128, 110, 0, Math.PI * 2); c.clip();
  g.paint(c);
  c.restore();
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
