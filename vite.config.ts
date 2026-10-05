import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the static build works on any host or sub-path (GitHub Pages, Netlify, Vercel).
export default defineConfig({
  base: './',
  plugins: [react()],
})
