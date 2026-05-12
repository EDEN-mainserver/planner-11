import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // 네이버 Open API CORS 우회 프록시
      '/naver-api': {
        target: 'https://openapi.naver.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/naver-api/, '/v1'),
        secure: true,
      },
      // dev에서 /api/* 호출을 라이브 Vercel 배포로 포워딩 (production에는 영향 없음)
      '/api': {
        target: 'https://planforge-ui.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
