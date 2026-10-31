# IMPLEMENTATION-LOG — Fase 1 (Foundation + Cinematic Pilot)

## Resumen
Landing inmersiva React + TypeScript + Vite con una única escena Three.js (WebGL 2) controlada por scroll nativo mediante una master timeline GSAP + ScrollTrigger. Solo dos geometrías provisionales: un marco triangular extruido (proxy del Penrose) y un cilindro (proxy del cohete).

## Dependencias (resueltas)
Runtime: `three 0.187`, `gsap 3.15`, `@fontsource-variable/inter 5.3`, `web-vitals 6.2`, `react 19.3`, `react-dom 19.3`.
Dev: `vite 8.3`, `typescript 7.0`, `@vitejs/plugin-react 6.1`, `@types/react`, `@types/react-dom`, `@types/three 0.187`, `@types/node`.
No se instalaron: React Three Fiber, Lenis, librerías de postprocesamiento externas ni otra librería de animación.

## Desviaciones y decisiones (respecto a `plan.md`)
1. **Gestor de paquetes: `pnpm` en lugar de `npm`.** `npm` no existe en el entorno de ejecución (solo `node` y `pnpm`). Mismas dependencias; lockfile `pnpm-lock.yaml`. Los scripts `.figma/make/*` usan pnpm.
2. **SSR no implementado.** `ssr.enabled` queda en `false` en todos los tiers (con un TODO para la Fase 2); el pipeline no tiene pasada SSR. Si se solicita con `?ssr=1` se registra un aviso y se omite. El brief lo condicionaba a "cuando el presupuesto lo permita".
3. **Rotación de la órbita 1 empieza en 88 %** (el plan decía 86 %): así el cilindro sigue exactamente el anillo hasta abandonarlo (continuidad de la estela).
4. **Órbitas 2 y 3 derivadas del anillo 1** girando su plano alrededor del eje que pasa por el punto de ramificación, para que se crucen realmente con la órbita 1 (formas y planos distintos).
5. **Colores de las órbitas algo más profundos** que `#58DDFB` (p. ej. `#29A8D6`) para mantener contraste sobre el fondo `#f2f2f4`; la emisión cian sigue siendo `#58DDFB`.
6. **Chispas con blending premultiplicado** (no aditivo) y el núcleo aditivo; el brillo se consigue con el bloom selectivo teñido (`BloomMixShader`). Sobre un estudio blanco el aditivo se vuelve blanco e invisible.
7. **Tapa de corte del reveal** en lavanda perla con emisión cian mínima (0.1) para respetar "cian prácticamente apagado" en la escena 1.
8. **CTA de contacto**: `mailto:hola@risynk.com` como placeholder documentado → `MISSING_FILL(CONTACT_ENDPOINT)`.
9. **Fuente**: Inter Variable (peso 350) → `MISSING_FILL(PP_NEUE_MONTREAL_FONT)`.
10. **Perfil por defecto**: MEDIUM en escritorio, LOW en móvil, SAFE con renderer por software. Un único ajuste automático tras ~120 frames medidos (sin histéresis; Fase 3).
11. **Entrada de carga**: `introDolly` (basado en tiempo) es el único canal no derivado del scroll; es aditivo y vuelve a 0 a los 2,4 s.

## Resultados de comandos
- `pnpm typecheck` (`tsc -b`): exit 0.
- `pnpm build` (`tsc -b && vite build`): exit 0. Aviso: el chunk JS es 1.33 MB (402 kB gzip) por three + gsap; la división de código corresponde a la Fase 4.
- `figma make verify-bootstrap`: `success`.
- `figma make verify-deploy`: `success`.
- `figma make verify-deploy-preview`: `success`.

## Verificación en navegador (Chromium headless + SwiftShader, WebGL por software)
Capturas en `docs/screenshots/`. Al ser render por software, los tiempos son validación funcional, **no** de rendimiento.
- Sin errores de consola en tiers 0, 1, 2 y 3 (GTAO y Bokeh incluidos en 2 y 3).
- Reversibilidad: bajar a 100 %, subir a 2 % y volver a 45 % / 80 % reproduce posición de cámara, cilindro, `cylinderProgress`, `orbitFormation1` y `orbitPhase` con diferencia máxima 0.
- `prefers-reduced-motion`: el estado salta por capítulo (cámara en presets, cilindro sin recorrido) y sin errores.
- Pérdida de contexto WebGL: se muestra el SVG estático y, tras `restoreContext`, la escena se reconstruye y vuelve a renderizar sin reiniciar la narrativa.
- Sin WebGL: `StaticFallback` con los 6 capítulos, 0 canvas y 0 errores de página.
- Viewports: 1440×900, 1100×700 y 390×844.

## Estado de criterios de aceptación
Ver el informe final de la fase en la conversación; resumen en la tabla de abajo.

| Criterio | Estado |
|---|---|
| La aplicación se inicia | OK |
| El canvas renderiza | OK |
| Triángulo con volumen y materiales | OK |
| Cilindro con volumen y materiales | OK |
| Cámara inicia cerrada | OK |
| Triángulo se revela progresivamente | OK |
| Señal energética se desplaza | OK |
| Cilindro aparece y se lanza | OK |
| Partículas visibles y reactivas al progreso | OK |
| Tres órbitas se forman | OK |
| Órbitas se sincronizan | OK |
| Cámara termina en encuadre completo | OK |
| Seis capítulos con sus textos | OK |
| Textos sincronizados con el scroll | OK |
| Scroll inverso revierte todo | OK (diferencia 0) |
| Pausas narrativas | OK |
| Sin saltos de cámara | OK (spline C1) — validar con GPU real |
| Escritorio y móvil | OK |
| Sin errores graves en consola | OK |
| Sin recursos 3D inventados | OK |

## Problemas conocidos / pendientes para la Fase 2+
- Valores de cámara y de bloom calibrados con render por software; conviene afinarlos con GPU real.
- SSR, WebGPU/TSL, SSGI y TAAU: Fase 2.
- Scoring definitivo, resolución dinámica e histéresis: Fase 3.
- División de código, texturas, draw calls y revisión de accesibilidad completa: Fase 4.
- El cielo del "estudio" es un color de fondo calibrado con AgX inverso (`backgroundMatch.ts`); no se ha verificado por píxel en un navegador con GPU.
