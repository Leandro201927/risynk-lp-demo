import { WebGLRenderer } from 'three';
import type { Capabilities } from './quality/CapabilityDetector';

export type BackendKind = 'webgl2' | 'webgpu';

/**
 * Fase 1: el backend base es WebGL 2. La rama WebGPU (WebGPURenderer + TSL + RenderPipeline) corresponde a la Fase 2
 * y NO está implementada: se declara explícitamente y se cae a WebGL 2.
 * TODO(Fase 2): equivalentes TSL de los materiales GLSL (triángulo, cilindro, órbitas, partículas).
 */
export function selectBackend(caps: Capabilities): BackendKind {
  if (caps.webgpuAvailable) console.info('[RendererFactory] WebGPU detectado, ruta TSL pendiente (Fase 2). Usando WebGL 2.');
  return 'webgl2';
}

export function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false,
  });
  renderer.debug.onShaderError = (gl, _program, vs, fs) => {
    console.error('[RISYNK] Error de compilación de shader', { vs: gl.getShaderInfoLog(vs), fs: gl.getShaderInfoLog(fs) });
  };
  return renderer;
}
