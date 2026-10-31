import {
  Color, HalfFloatType, Vector2, WebGLRenderTarget, type Camera, type Material, type Object3D, type Scene, type Texture, type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import type { QualityConfig } from '../quality/qualityProfiles';
import { BloomMixShader } from './BloomMixShader';

interface BloomEntry {
  obj: Object3D & { material: Material | Material[] };
  original: Material | Material[];
  mask: Material | Material[] | null; // null => ocultar durante la pasada de máscara
}

/**
 * Pipeline WebGL 2 (EffectComposer). Dos composers:
 *  - bloomComposer: pasada de máscara emisiva separada (solo cian/energía; el resto es oclusor negro) + UnrealBloom.
 *  - finalComposer: Render -> GTAO -> mezcla de bloom (teñido) -> Bokeh -> Output (AgX + sRGB, única transformación) -> SMAA.
 */
export class WebGLPipeline {
  private bloomComposer!: EffectComposer;
  private finalComposer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private mixPass!: ShaderPass;
  private gtao: GTAOPass | null = null;
  private bokeh: BokehPass | null = null;
  private entries: BloomEntry[] = [];
  private black = new Color(0x000000);
  private w = 1;
  private h = 1;
  private pr = 1;
  bloomEnabled = true;

  constructor(private renderer: WebGLRenderer, private scene: Scene, private camera: Camera, private q: QualityConfig) {
    this.build(q);
  }

  private build(q: QualityConfig): void {
    this.dispose(false);
    this.q = q;
    const r = this.renderer;

    // --- máscara de bloom
    const bloomRT = new WebGLRenderTarget(this.w * this.pr, this.h * this.pr, { type: HalfFloatType });
    this.bloomComposer = new EffectComposer(r, bloomRT);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new Vector2(this.w, this.h), q.bloom.strength, q.bloom.radius, 0);
    this.bloomComposer.addPass(this.bloomPass);

    // --- composición final
    const finalRT = new WebGLRenderTarget(this.w * this.pr, this.h * this.pr, { type: HalfFloatType, samples: q.msaa });
    this.finalComposer = new EffectComposer(r, finalRT);
    this.finalComposer.addPass(new RenderPass(this.scene, this.camera));
    if (q.gtao.enabled) {
      this.gtao = new GTAOPass(this.scene, this.camera, this.w, this.h);
      this.gtao.output = GTAOPass.OUTPUT.Default;
      this.gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1, samples: q.gtao.samples, distanceFallOff: 1 });
      this.gtao.blendIntensity = q.gtao.intensity;
      this.finalComposer.addPass(this.gtao);
    }
    this.mixPass = new ShaderPass(BloomMixShader);
    this.finalComposer.addPass(this.mixPass);
    if (q.dof.enabled) {
      this.bokeh = new BokehPass(this.scene, this.camera, { focus: 5, aperture: 0, maxblur: q.dof.maxBlur });
      this.finalComposer.addPass(this.bokeh);
    }
    this.finalComposer.addPass(new OutputPass());
    if (q.smaa) this.finalComposer.addPass(new SMAAPass());
    this.setSize(this.w, this.h, this.pr);
  }

  rebuild(q: QualityConfig): void {
    this.build(q);
    this.refreshBloomList();
  }

  setSize(w: number, h: number, pixelRatio: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.pr = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(this.w, this.h, false);
    this.finalComposer.setPixelRatio(pixelRatio);
    this.finalComposer.setSize(this.w, this.h);
    this.bloomComposer.setPixelRatio(pixelRatio * this.q.bloom.resolutionScale);
    this.bloomComposer.setSize(this.w, this.h);
  }

  /** Recorre la escena y registra qué material usar en la pasada de máscara (userData.bloom: 'self' | Material | 'hide'). */
  refreshBloomList(): void {
    this.entries = [];
    this.scene.traverse((o) => {
      const any = o as Object3D & { material?: Material | Material[]; isMesh?: boolean; isPoints?: boolean };
      if (!(any.isMesh || any.isPoints) || !any.material) return;
      const tag = o.userData.bloom as Material | 'self' | 'hide' | undefined;
      const mask = tag === 'self' ? any.material : tag && tag !== 'hide' ? tag : null;
      this.entries.push({ obj: any as BloomEntry['obj'], original: any.material, mask });
    });
  }

  private swapIn(): { bg: Scene['background']; visible: boolean[] } {
    const visible: boolean[] = [];
    for (const e of this.entries) {
      visible.push(e.obj.visible);
      if (e.mask) e.obj.material = e.mask;
      else e.obj.visible = false;
    }
    const bg = this.scene.background;
    this.scene.background = this.black;
    return { bg, visible };
  }

  private swapOut(saved: { bg: Scene['background']; visible: boolean[] }): void {
    this.entries.forEach((e, i) => {
      e.obj.material = e.original;
      e.obj.visible = saved.visible[i] as boolean;
    });
    this.scene.background = saved.bg;
  }

  /** Parámetros por frame: AO, DoF y bloom (sin asignaciones). */
  setFrameParams(p: { gtaoBlend: number; focus: number; aperture: number; bloomStrength: number }): void {
    if (this.gtao) {
      this.gtao.enabled = p.gtaoBlend > 0.001;
      this.gtao.blendIntensity = this.q.gtao.intensity * p.gtaoBlend;
    }
    if (this.bokeh) {
      const ap = p.aperture * this.q.dof.apertureScale;
      this.bokeh.enabled = ap * this.q.dof.maxBlur > 1e-5;
      const u = (this.bokeh as unknown as { uniforms: Record<string, { value: number }> }).uniforms;
      u.focus!.value = p.focus;
      u.aperture!.value = ap * 0.00018;
      u.maxblur!.value = this.q.dof.maxBlur;
    }
    this.bloomPass.strength = this.q.bloom.strength * p.bloomStrength;
  }

  render(): void {
    if (this.bloomEnabled) {
      const saved = this.swapIn();
      this.bloomComposer.render();
      this.swapOut(saved);
      this.mixPass.uniforms.tBloom!.value = this.bloomComposer.readBuffer.texture as Texture;
    } else {
      this.mixPass.uniforms.tBloom!.value = null;
    }
    this.finalComposer.render();
  }

  private dispose(final = true): void {
    for (const c of [this.bloomComposer, this.finalComposer] as Array<EffectComposer | undefined>) {
      if (!c) continue;
      c.passes.forEach((p) => (p as unknown as { dispose?: () => void }).dispose?.());
      c.renderTarget1.dispose();
      c.renderTarget2.dispose();
    }
    this.gtao = null;
    this.bokeh = null;
    if (final) this.entries = [];
  }

  destroy(): void {
    this.dispose(true);
  }
}
