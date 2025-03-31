import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Set base to './' for correct asset paths in Electron build
  base: './',
  build: {
    // Output directory (relative to project root)
    outDir: 'dist',
    // Empty the output directory before building
    emptyOutDir: true,
  },
  server: {
    // Port for the development server
    port: 5173, // Or any other available port
    // Exit if port is already in use
    strictPort: true,
  },
  resolve: {
    // Alias for easier imports (optional but good practice)
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Let Vite automatically use postcss.config.cjs
});
