import { MISSING_FILLS } from './missingFills';

/** Etapas del futuro precargado: 0 poster, 1 capítulo actual, 2 adyacentes, 3 restantes. */
export type PreloadStage = 0 | 1 | 2 | 3;

export interface AssetStatus {
  id: string;
  state: 'missing';
}

/**
 * Interfaz de carga por etapas. En la Fase 1 TODOS los recursos de producción son MISSING_FILL:
 * no se descarga ni se genera nada. Se registra una única nota informativa en desarrollo.
 * TODO: MISSING_FILL(NEAREST_FRAME_IMAGE_SEQUENCE) — getNearestFrame() devolverá la imagen decodificada más próxima.
 */
export class AssetManager {
  private logged = false;

  preload(stage: PreloadStage, chapter: number): AssetStatus[] {
    if (import.meta.env.DEV && !this.logged) {
      this.logged = true;
      console.info(`[AssetManager] Fase 1: ${MISSING_FILLS.length} recursos MISSING_FILL (sin descargas). stage=${stage} chapter=${chapter}`);
    }
    return MISSING_FILLS.map((m) => ({ id: m.id, state: 'missing' as const }));
  }

  /** TODO: MISSING_FILL(NEAREST_FRAME_IMAGE_SEQUENCE) */
  getNearestFrame(_progress: number): ImageBitmap | null {
    return null;
  }

  has(id: string): boolean {
    return !MISSING_FILLS.some((m) => m.id === id);
  }
}
