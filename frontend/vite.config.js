import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // ── Code splitting — separate vendor chunks ──
    // This creates smaller, independently cacheable bundles.
    // When you update your app code, users don't re-download unchanged vendor libraries.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-socket': ['socket.io-client'],
          'vendor-ui': ['lucide-react'],
          'vendor-qr': ['react-qr-code'],
        }
      }
    },
    // ── Minification ──
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,   // Remove console.log in production builds
        drop_debugger: true,  // Remove debugger statements
      }
    },
    // Target modern browsers for smaller output
    target: 'es2020',
  }
})
