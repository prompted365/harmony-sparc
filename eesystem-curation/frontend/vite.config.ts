import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Development server configuration
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    hmr: {
      clientPort: 3000
    }
  },
  
  // Build configuration for production
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'],
      },
      mangle: {
        safari10: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-switch',
            '@radix-ui/react-progress',
            '@radix-ui/react-avatar',
            '@radix-ui/react-alert-dialog'
          ],
          charts: ['recharts'],
          utils: [
            'date-fns',
            'clsx',
            'tailwind-merge',
            'class-variance-authority'
          ],
          icons: ['lucide-react'],
          forms: ['react-dropzone', 'react-day-picker']
        },
        // Optimize chunk sizes
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId 
            ? chunkInfo.facadeModuleId.split('/').pop().replace('.tsx', '').replace('.ts', '') 
            : 'chunk';
          return `js/${facadeModuleId}-[hash].js`;
        },
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: ({ name }) => {
          if (/\.(gif|jpe?g|png|svg)$/.test(name ?? '')) {
            return 'images/[name]-[hash][extname]';
          }
          if (/\.css$/.test(name ?? '')) {
            return 'css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    // Optimize bundle size
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: false,
    
    // Source maps for production debugging
    sourcemap: process.env.NODE_ENV === 'production' ? false : true,
  },
  
  // Dependencies to pre-bundle in development
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'clsx',
      'tailwind-merge'
    ],
  },
  
  // Preview server configuration
  preview: {
    host: true,
    port: 3000,
    strictPort: true,
  },
  
  // Environment variables configuration
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
