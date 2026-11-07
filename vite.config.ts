import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// 참고문헌 RAG API (python -m uvicorn server.app:app --port 8000) — 다른 포트면 RAG_API=http://127.0.0.1:8001
const apiProxy = { '/api': process.env.RAG_API ?? 'http://127.0.0.1:8000' };

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 계산기·체크리스트 키트 (커밋하지 않는 폴더 — 프로젝트 루트에 직접 넣는다). src/lib/kit.ts 만 import 한다.
      '@kit': fileURLToPath(new URL('./hrsg_calc_kit_team1', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: false,
    proxy: apiProxy,
  },
  // npm run preview(빌드 결과)도 같은 프록시를 써야 /api 가 index.html 로 떨어지지 않는다
  preview: { proxy: apiProxy },
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
