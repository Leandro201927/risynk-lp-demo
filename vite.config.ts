import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dentro de Figma Make el preview se sirve desde un origen público: se permite únicamente ese host.
const figmaHost = (() => {
  try {
    return process.env.FIGMA && process.env.FIGMA_PUBLIC_URL ? new URL(process.env.FIGMA_PUBLIC_URL).hostname : null;
  } catch {
    return null;
  }
})();

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022', sourcemap: true },
  server: figmaHost ? { allowedHosts: [figmaHost] } : {},
});
