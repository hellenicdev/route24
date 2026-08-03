import { defineConfig } from 'vite';

// GitHub Pages project site: https://hellenicdev.github.io/route24/
export default defineConfig({
  base: '/route24/',
  build: {
    target: 'esnext',
    sourcemap: true,
    chunkSizeWarningLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('@babylonjs/core') || id.includes('@babylonjs/materials'))
            return 'babylon';
        },
      },
    },
  },
});
