# Dirección de cámara

Fuente única: `src/scene/camera/cameraPresets.ts` (`SHOTS`, `TRACK_POSE`). Este documento resume la intención de cada plano.

## Arquitectura: framing cinematográfico vs. framing responsive

| Capa | Dónde | Qué decide | Qué NO puede hacer |
|---|---|---|---|
| **Cinematic framing** | `SHOTS[i].pose` (+ `mobile`) | target, azimut, elevación, distancia, FOV, alabeo y apertura de cada plano | — |
| **Interpolación** | `CameraController.update` | mezcla entre planos en espacio orbital: target lineal, azimut/elevación lineales, distancia en escala logarítmica | No usa spline; no atraviesa geometría; no persigue vértices |
| **Responsive safe framing** | `CameraController.responsiveDistanceFactor` | Solo **amplía** la distancia cuando el viewport real es más estrecho que el viewport de referencia (`REF_DESKTOP` 1.6 × 58 %, `REF_MOBILE` 0.92 × 100 %) | Nunca acerca, nunca redefine el plano. Sin bounding sphere genérica |
| **Región libre de texto** | `SceneRuntime.resize` → `filmOffset` | Centra el sujeto en el área libre a la derecha de la columna editorial | — |

La protección anterior (`max(d0, radio / sin(semiángulo))`) se eliminó: sobrescribía los planos y alejaba o acercaba la cámara sin intención artística.

## Planos

| # | Plano | Capítulo | Sujeto / punto de atención | Entrada → salida | Lectura |
|---|---|---|---|---|---|
| 0 | `SHOT_01_STOREFRONT` | 01 | Fachada procedural con puerta iluminada, dentro de la estructura. Fachada ≈ 45 % de la región, centrada | Fotograma inicial → dolly-out lento (11–14 %) | 0–14 % |
| 1 | `SHOT_02_REVEAL` | 02 | Triángulo completo, ≈ 70 % de la región, margen ≥ 8 % | Dolly-out + orbitación (14–25 %) → hold | 25–29 % |
| 2 | `SHOT_03_NEED` | 03 | Estructura completa; punto cian sobre la viga inferior. Mismo tamaño que el plano 1 (sin zoom) | Orbitación leve (29–34 %) → deriva (34–38 %) | 34–42 % |
| 3 | `SHOT_04_TRANSFORMATION` | 04 | Fachada central y las tres vigas. Encuadre medio | Orbitación suave (42–47 %) | 47–58 % |
| 4 | `SHOT_05_ACTIVATION` | 05 | Vértice superior, cuna de lanzamiento y cohete; triángulo completo | Elevación (58–63 %) → seguimiento (73 %) | 63–73 % |
| 5 | `SHOT_06A_ORBIT_REVEAL` | 06 | Sistema orbital completo y núcleo triangular | Salida del seguimiento (81–88 %) | 88–94 % |
| 6 | `SHOT_06B_FINAL` | 06 | Igual con orbitación mínima | 94–99 % | 99–100 % |

`TRACK_POSE` (seguimiento del cohete) usa el mismo espacio orbital que los planos y mezcla el punto de atención con el núcleo (`coreBias`) para que el triángulo no salga de cuadro durante el lanzamiento.

## Márgenes verificados (1440×900, región libre = 610–1440 px)

| Progreso | Elemento | Caja proyectada (px) |
|---|---|---|
| 26 % | triángulo | 760,217 → 1314,741 |
| 38 % | triángulo | 754,217 → 1331,734 |
| 53 % | triángulo | 688,79 → 1371,683 (antes del ajuste de plano 3/4) |
| 68–72 % | triángulo + cohete | 779,351 → 1275,792 · cohete 1001,108 → 1049,330 |
| 97 % | órbitas | 700,177 → 1339,748 |

Las cajas se obtienen con `window.__RISYNK__.runtime.debugBounds()` (solo con `?debug`).
