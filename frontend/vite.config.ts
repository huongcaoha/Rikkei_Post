import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'window',
  },
  server: {
    host: '0.0.0.0', // Lắng nghe trên mọi interface mạng
    port: 3000,
    // Cho phép truy cập từ domain huongcaoha.site và localhost mà không bị Vite chặn Host header
    allowedHosts: [
      'huongcaoha.site',
      '.huongcaoha.site',
      'localhost',
      '127.0.0.1'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws-logistics': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-antd': ['antd', '@ant-design/icons'],
          'vendor-leaflet': ['leaflet'],
          'vendor-icons': ['lucide-react'],
        }
      }
    }
  }
})
