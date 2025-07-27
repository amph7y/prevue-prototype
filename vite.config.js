import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/pubmed-api': {
        target: 'https://eutils.ncbi.nlm.nih.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pubmed-api/, ''),
      },
      '/elsevier-api': {
        target: 'https://api.elsevier.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/elsevier-api/, ''),
      },
    },
  },
})