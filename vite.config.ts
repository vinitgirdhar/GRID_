import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      // Pre-bundle heavy deps so the browser doesn't stall on first load
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'leaflet',
        'react-leaflet',
        'recharts',
        'lucide-react',
        'motion',
        '@google/genai',
        'clsx',
        'tailwind-merge',
      ],
      // @mediapipe/tasks-vision ships its own WASM loader — Vite must not
      // pre-bundle it or the internal WASM paths get rewritten and break at runtime.
      exclude: ['@mediapipe/tasks-vision'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true'
        ? { host: 'localhost' }
        : false,
    },
  };
});
