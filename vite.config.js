import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy for PubMed API
      '/pubmed-api': {
        target: 'https://eutils.ncbi.nlm.nih.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pubmed-api/, ''),
      },
      // Proxy for Elsevier API (Scopus/Embase)
      '/elsevier-api': {
        target: 'https://api.elsevier.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/elsevier-api/, ''),
      },
    },
  },
})