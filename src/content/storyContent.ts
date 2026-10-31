export interface ChapterContent {
  id: string;
  anchor: string;
  label: string;
  title: string;
  description: string;
  tags?: string[];
  hint?: string;
  cta?: string;
  closing?: string;
}

// Fuente única del copy. Textos literales del brief (sección 8).
export const CHAPTERS: ChapterContent[] = [
  {
    id: 'perspectiva',
    anchor: 'perspectiva',
    label: 'UNA NUEVA PERSPECTIVA',
    title: 'Tu negocio es mucho más de lo que hoy puedes ver.',
    description: 'Hoy solo percibes una parte de todo lo que puedes llegar a construir.',
    hint: 'Desplázate para descubrirlo ↓',
  },
  {
    id: 'ecosistema',
    anchor: 'ecosistema',
    label: 'EL ECOSISTEMA',
    title: 'El crecimiento ocurre cuando todo trabaja en conjunto.',
    description: 'Integramos capacidades que conectan tu presencia, tus procesos y tus oportunidades.',
    tags: ['INTEGRACIÓN', 'AUTOMATIZACIÓN', 'COHERENCIA'],
  },
  {
    id: 'necesidad',
    anchor: 'proceso',
    label: '01 / NECESIDAD',
    title: 'Todo empieza por entender lo que necesitas.',
    description: 'Definimos objetivos, detectamos fricciones y priorizamos las oportunidades que realmente importan.',
  },
  {
    id: 'transformacion',
    anchor: 'capacidades',
    label: '02 / TRANSFORMACIÓN',
    title: 'Convertimos necesidades en soluciones digitales.',
    description: 'Diseñamos una presencia coherente y conectamos las herramientas que tu negocio necesita para evolucionar.',
    tags: ['PRESENCE', 'MARKETING', 'CRM', 'COMMERCE'],
  },
  {
    id: 'sincronizacion',
    anchor: 'sincronizacion',
    label: '03 / SINCRONIZACIÓN',
    title: 'Todo conectado. Todo trabajando en la misma dirección.',
    description: 'Integramos herramientas, procesos y canales para que tu ecosistema digital funcione con coherencia.',
  },
  {
    id: 'crecimiento',
    anchor: 'crecimiento',
    label: '04 / CRECIMIENTO',
    title: 'Tu negocio, preparado para seguir creciendo.',
    description:
      'Visibilidad, relaciones y resultados dejan de trabajar por separado. Se conectan en un sistema que evoluciona contigo.',
    tags: ['VISIBILIDAD', 'RELACIONES', 'RESULTADOS'],
    cta: 'Hablemos de tu proyecto',
    closing: 'Rise. Sync. Grow.',
  },
];

export const NAV_LINKS = [
  { label: 'Ecosistema', chapter: 1 },
  { label: 'Proceso', chapter: 2 },
  { label: 'Capacidades', chapter: 3 },
] as const;

// TODO: MISSING_FILL(CONTACT_ENDPOINT) — destino real de contacto (email o URL) pendiente de confirmar.
// Placeholder documentado en docs/MISSING-FILLS.md: es un mailto válido, no un enlace roto.
export const CONTACT = {
  href: 'mailto:hola@risynk.com?subject=Hablemos%20de%20mi%20proyecto',
  navLabel: 'Contacto',
};
