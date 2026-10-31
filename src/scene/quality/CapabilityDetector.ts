export interface Capabilities {
  webgl2: boolean;
  timerQuery: boolean;
  colorBufferFloat: boolean;
  halfFloat: boolean;
  maxTextureSize: number;
  maxSamples: number;
  webgpuAvailable: boolean; // informativo en Fase 1
  deviceMemory: number | null;
  cores: number;
  coarsePointer: boolean;
  reducedMotion: boolean;
  isMobile: boolean;
  renderer: string;
}

export function detectCapabilities(): Capabilities {
  const nav = navigator as Navigator & { deviceMemory?: number; gpu?: unknown };
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const caps: Capabilities = {
    webgl2: false, timerQuery: false, colorBufferFloat: false, halfFloat: false, maxTextureSize: 0, maxSamples: 0,
    webgpuAvailable: Boolean(nav.gpu), deviceMemory: nav.deviceMemory ?? null, cores: navigator.hardwareConcurrency || 4,
    coarsePointer: coarse, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    isMobile: coarse && Math.min(window.innerWidth, window.innerHeight) < 820, renderer: 'unknown',
  };
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) return caps;
  caps.webgl2 = true;
  caps.timerQuery = Boolean(gl.getExtension('EXT_disjoint_timer_query_webgl2'));
  caps.colorBufferFloat = Boolean(gl.getExtension('EXT_color_buffer_float'));
  caps.halfFloat = Boolean(gl.getExtension('EXT_color_buffer_half_float')) || caps.colorBufferFloat;
  caps.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  caps.maxSamples = gl.getParameter(gl.MAX_SAMPLES) as number;
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  if (dbg) caps.renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return caps;
}

/** Software rendering (SwiftShader, llvmpipe...) no debe recibir el perfil más alto. */
export function isSoftwareRenderer(caps: Capabilities): boolean {
  return /swiftshader|llvmpipe|software|softpipe/i.test(caps.renderer);
}
