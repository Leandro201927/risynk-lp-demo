export type Vec3 = [number, number, number];

/**
 * CINEMATIC FRAMING — el plano artístico. Cada plano se define por un punto de atención (target) y una posición
 * ORBITAL alrededor de él (azimut, elevación, distancia), más FOV y alabeo. Ninguna protección geométrica genérica
 * puede alterar estos valores: el ajuste responsive vive aparte (ver CameraController.responsiveDistance).
 *
 * Convención: azimut > 0 = cámara a la derecha del eje +Z; elevación > 0 = cámara por encima del target.
 * Las poses se interpolan por componentes (orbitando + dolly en log), no con una spline que cruce la geometría.
 */
export interface ShotPose {
  target: Vec3;
  azimuth: number; // grados
  elevation: number; // grados
  distance: number; // unidades de escena
  fov: number; // grados (vertical)
  roll: number; // radianes
  aperture: number; // escala del BokehPass (0 = nítido)
}

export interface ShotDirection {
  /** Dirección de arte: documentación viva del plano (también volcada en docs/CAMERA-DIRECTION.md). */
  id: string;
  chapter: number;
  objective: string;
  subject: string;
  attention: string;
  screen: string; // escala y posición del sujeto en la región derecha
  margins: string;
  entry: string;
  exit: string;
  readingTime: string;
}

export interface Shot extends ShotDirection {
  /** Pose de escritorio autorada para el viewport de referencia (REF_DESKTOP). */
  pose: ShotPose;
  /** Pose móvil autorada para el viewport de referencia (REF_MOBILE): sustituye valores, no escala. */
  mobile?: Partial<ShotPose>;
}

/** Viewports de referencia para los que se autoran las distancias. El ajuste responsive es relativo a ellos. */
/** heightFraction: fracción vertical útil (descontada la barra de navegación fija, ≈ 90 px sobre 900 px). */
export const REF_DESKTOP = { aspect: 1.6, regionFraction: 0.58, heightFraction: 0.9 } as const;
export const REF_MOBILE = { aspect: 0.92, regionFraction: 1, heightFraction: 0.89 } as const;

const P = (target: Vec3, azimuth: number, elevation: number, distance: number, fov = 34, aperture = 0, roll = 0): ShotPose => ({
  target, azimuth, elevation, distance, fov, roll, aperture,
});

/** Orden = índice de cameraU (0..6). */
export const SHOTS: Shot[] = [
  {
    id: 'SHOT_01_STOREFRONT', chapter: 1,
    objective: 'Intriga y reconocimiento: un negocio pequeño dentro de una estructura mayor.',
    subject: 'Fachada procedural (acceso, marco, zona de luz) apoyada en la cara interior de la viga inferior.',
    attention: 'Puerta iluminada.',
    screen: 'Fachada ≈ 45 % del ancho de la región; centrada en ella, ligeramente por debajo del centro.',
    margins: 'La viga inferior sale por los lados (se desvanece con la máscara CSS antes del texto).',
    entry: 'Fotograma inicial (sin entrada).', exit: 'Dolly-out lento: aleja y orbita hacia el triángulo completo.',
    readingTime: '0–14 % (hold hasta el 11 %).',
    pose: P([0.0, -0.2, 0.05], 16, 9, 2.75, 30, 0.45),
    mobile: { distance: 3.4 },
  },
  {
    id: 'SHOT_02_REVEAL', chapter: 2,
    objective: 'Revelar la estructura completa, reconocible y con margen.',
    subject: 'Triángulo completo (3 vigas).', attention: 'Vértice superior y recorrido de la línea cian.',
    screen: 'Triángulo ≈ 80 % del ancho de la región, centrado, ≥ 8 % de margen.',
    margins: 'Sin recortes: la silueta completa cabe con aire en los cuatro lados.',
    entry: 'Dolly-out desde SHOT_01 (14–25 %).', exit: 'Hold; ligera aproximación a SHOT_03.',
    readingTime: '25–29 %.',
    pose: P([0, 0.3, 0], 24, 12, 5.9),
    mobile: { distance: 6.0 },
  },
  {
    id: 'SHOT_03_NEED', chapter: 3,
    objective: 'Precisión y diagnóstico: un único punto recorre una arista real.',
    subject: 'Estructura completa con el punto cian y su estela.', attention: 'Punto cian sobre la viga inferior.',
    screen: 'Mismo tamaño que SHOT_02 (sin zoom agresivo), centro desplazado hacia la viga inferior.',
    margins: 'Igual que SHOT_02.',
    entry: 'Leve orbitación desde SHOT_02.', exit: 'Deriva suave hacia el centro.',
    readingTime: '34–42 %.',
    pose: P([-0.05, 0.3, 0], 20, 9, 5.8),
    mobile: { distance: 6.1 },
  },
  {
    id: 'SHOT_04_TRANSFORMATION', chapter: 4,
    objective: 'Inteligencia y transformación coordinada: la energía llega al centro y se reparte.',
    subject: 'Fachada central + las tres vigas.', attention: 'Zona central y los tres segmentos.',
    screen: 'Encuadre medio: triángulo completo, fachada legible.',
    margins: 'Triángulo entero dentro de la región.',
    entry: 'Orbitación suave desde SHOT_03.', exit: 'Elevación hacia el vértice superior.',
    readingTime: '47–58 %.',
    pose: P([0, 0.3, 0], 14, 7, 5.7),
    mobile: { distance: 6.0 },
  },
  {
    id: 'SHOT_05_ACTIVATION', chapter: 5,
    objective: 'Culminación contenida: el cohete emerge del vértice, se activa y se prepara.',
    subject: 'Mitad superior del triángulo, base de lanzamiento y cohete.', attention: 'Vértice superior y su cuna de lanzamiento.',
    screen: 'Vértice en el tercio superior; triángulo y cohete completos (acercamiento moderado).',
    margins: 'Cohete con aire por encima; base del triángulo dentro del cuadro.',
    entry: 'Elevación y ligero acercamiento (58–63 %).', exit: 'Seguimiento del cohete (73 %).',
    readingTime: '63–73 %.',
    pose: P([0, 0.8, 0], 14, 10, 6.8),
    mobile: { distance: 7.6, target: [0, 0.85, 0] },
  },
  {
    id: 'SHOT_06A_ORBIT_REVEAL', chapter: 6,
    objective: 'Expansión: la estela se convierte en la primera órbita y nacen las otras dos.',
    subject: 'Tres órbitas y el núcleo triangular.', attention: 'Punto de ramificación de las órbitas.',
    screen: 'Sistema orbital completo dentro de la región; triángulo visible como núcleo.',
    margins: 'Órbitas ≥ 6 % de margen.',
    entry: 'Salida del seguimiento (81–88 %).', exit: 'Asentamiento final.',
    readingTime: '88–94 %.',
    pose: P([0, 0.2, 0], 20, 14, 10.3),
    mobile: { distance: 10.7 },
  },
  {
    id: 'SHOT_06B_FINAL', chapter: 6,
    objective: 'Continuidad: sistema vivo, equilibrado y legible.',
    subject: 'Tres órbitas con etiquetas conceptuales y el triángulo.', attention: 'Triángulo como núcleo.',
    screen: 'Igual que SHOT_06A con orbitación mínima.',
    margins: 'Igual que SHOT_06A.',
    entry: 'Orbitación mínima (94–99 %).', exit: 'Final del scroll.',
    readingTime: '99–100 %.',
    pose: P([0, 0.2, 0], 25, 16, 10.0),
    mobile: { distance: 10.4 },
  },
];

/** Plano de seguimiento del cohete (SHOT_06 tracking): pose fija relativa a la cabeza del cohete. */
export const TRACK_POSE: { desktop: ShotPose; mobile: Partial<ShotPose>; core: Vec3; coreBias: number } = {
  desktop: P([0, 0, 0], 20, 10, 8.4, 35, 0),
  mobile: { distance: 9.8 },
  /** El seguimiento no persigue al cohete a ciegas: el punto de atención se mezcla con el núcleo para que el triángulo no salga de cuadro. */
  core: [0, 0.6, 0],
  coreBias: 0.45,
};
