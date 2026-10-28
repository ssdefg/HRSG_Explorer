import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    open: false,
    // 참고문헌 RAG API (python -m uvicorn server.app:app --port 8000)
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  build: {
    rollupOptions: {
      output: {
        // 라이브러리를 앱 코드와 분리 — 앱 코드만 바뀔 때 캐시를 재사용하고 단일 청크 크기 경고를 피한다
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (/[\\/]node_modules[\\/](d3-[^\\/]+|internmap|victory-vendor)[\\/]/.test(id)) return 'd3';
          return 'vendor';
        },
      },
    },
  },
});
